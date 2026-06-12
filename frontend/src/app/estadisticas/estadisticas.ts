import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

import { CANONICAL_ESTADOS, Incident, IncidentPrioridad } from '../incidents/incident.model';
import { IncidentLoadStatus, IncidentService } from '../incidents/incident.service';
import { SlaBucket, slaBucket } from '../incidents/sla';

/** Only the pieces the doughnut and the column chart use — never the auto-registering bundle. */
Chart.register(
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
);

/** Prioridad display order by severity. Estado order is CANONICAL_ESTADOS (lifecycle), from the model. */
const PRIORIDAD_ORDER: readonly IncidentPrioridad[] = ['Critica', 'Alta', 'Media', 'Baja'];

/** SLA buckets in display order, with the list's exact labels and the existing fill tokens. */
const SLA_BUCKETS: readonly { bucket: SlaBucket; label: string; token: string }[] = [
  { bucket: 'vencida', label: 'Vencidas', token: '--color-red' },
  { bucket: 'a-punto', label: 'A punto de vencer', token: '--color-warn' },
  { bucket: 'dentro', label: 'Dentro de plazo', token: '--color-green-700' },
];

/** One distribution entry: a value label with its record count and rounded percentage of the total. */
interface StatBar<T extends string> {
  label: T;
  count: number;
  percent: number;
}

@Component({
  selector: 'app-estadisticas',
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Estadisticas {
  private readonly service = inject(IncidentService);

  protected readonly data = toSignal(this.service.getIncidents(), {
    initialValue: [] as Incident[],
  });

  /** Drives the state branches: 'loading' until the shared fetch resolves, then 'success' | 'error'. */
  protected readonly status = toSignal(this.service.getLoadStatus(), {
    initialValue: 'loading' as IncidentLoadStatus,
  });

  /** "now" captured once per data load (shared shareReplay(1) fetch, no second request); no live ticking. */
  private readonly slaNow = toSignal(this.service.getIncidents().pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  private readonly estadoCanvas = viewChild<ElementRef<HTMLCanvasElement>>('estadoCanvas');
  private readonly slaCanvas = viewChild<ElementRef<HTMLCanvasElement>>('slaCanvas');

  private estadoChart: Chart<'doughnut', number[], string> | undefined;
  private slaChart: Chart<'bar', number[], string> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.estadoChart?.destroy();
      this.slaChart?.destroy();
    });
    // Render hooks never run on the server: charts stay browser-only; prerender ships the sr-only tables.
    afterRenderEffect(() => {
      this.buildEstadoChart();
      this.buildSlaChart();
    });
  }

  protected readonly total = computed(() => this.data().length);

  /** Canonical estado segments in lifecycle order, plus an "Otros" bucket for any non-canonical estado. */
  protected readonly estadoStats = computed<StatBar<string>[]>(() => {
    const bars: StatBar<string>[] = this.buildStats(CANONICAL_ESTADOS, 'estado');
    const total = this.total();
    const canonicalSum = bars.reduce((sum, bar) => sum + bar.count, 0);
    const otros = total - canonicalSum;
    if (otros > 0) {
      bars.push({ label: 'Otros', count: otros, percent: Math.round((otros / total) * 100) });
    }
    return bars;
  });

  protected readonly prioridadStats = computed(() => this.buildStats(PRIORIDAD_ORDER, 'prioridad'));

  protected readonly resumen = computed(() => {
    const counts = this.countBy('estado');
    return {
      total: this.total(),
      porHacer: counts['Por hacer'] ?? 0,
      enCurso: counts['En curso'] ?? 0,
      enRevision: counts['En revisión'] ?? 0,
      finalizado: counts['Finalizado'] ?? 0,
    };
  });

  /** The three SLA bucket counts via slaBucket — the single source of truth; null results join no bucket. */
  protected readonly slaStats = computed(() => {
    const nowMs = this.slaNow();
    const counts: Record<SlaBucket, number> = { vencida: 0, 'a-punto': 0, dentro: 0 };
    for (const incident of this.data()) {
      const bucket = slaBucket(incident, nowMs);
      if (bucket !== null) {
        counts[bucket] += 1;
      }
    }
    return SLA_BUCKETS.map(({ bucket, label }) => ({ bucket, label, count: counts[bucket] }));
  });

  /** Daily KPIs; "today" is the browser's local calendar day, midnight to midnight. */
  protected readonly controlDiario = computed(() => {
    const today = new Date(this.slaNow());
    let creadasHoy = 0;
    let resueltasHoy = 0;
    for (const incident of this.data()) {
      if (this.isSameLocalDay(new Date(incident.fecha_creacion), today)) {
        creadasHoy += 1;
      }
      if (
        incident.estado === 'Finalizado' &&
        incident.fecha_cierre !== null &&
        this.isSameLocalDay(new Date(incident.fecha_cierre), today)
      ) {
        resueltasHoy += 1;
      }
    }
    const buckets = this.slaStats();
    const conPlazo = buckets.reduce((sum, row) => sum + row.count, 0);
    const dentro = buckets.find((row) => row.bucket === 'dentro')?.count ?? 0;
    return {
      creadasHoy,
      resueltasHoy,
      pctDentro: conPlazo === 0 ? 0 : Math.round((dentro / conPlazo) * 100),
    };
  });

  protected prioridadColor(prioridad: IncidentPrioridad): string {
    switch (prioridad) {
      case 'Critica':
        return 'var(--color-red)';
      case 'Alta':
        return 'var(--color-orange-500)';
      case 'Media':
        return 'var(--color-warn)';
      case 'Baja':
        return 'var(--color-green-700)';
    }
  }

  /** Spanish screen-reader prose for a bar; singular/plural on "incidencia". */
  protected barAriaLabel(row: StatBar<string>): string {
    const noun = row.count === 1 ? 'incidencia' : 'incidencias';
    return `${row.label}: ${row.count} ${noun}, ${row.percent}%`;
  }

  /** Builds the doughnut once, when its canvas first appears; the load emits once, so data is final. */
  private buildEstadoChart(): void {
    const canvas = this.estadoCanvas()?.nativeElement;
    if (this.estadoChart !== undefined || canvas === undefined) {
      return;
    }
    const rows = this.estadoStats();
    this.estadoChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [
          {
            data: rows.map((row) => row.count),
            backgroundColor: rows.map((row) => this.cssColor(this.estadoToken(row.label))),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (item) => {
                const row = rows[item.dataIndex];
                return `${row.label}: ${row.count} · ${row.percent}%`;
              },
            },
          },
        },
      },
    });
  }

  /** Builds the SLA column chart once, when its canvas first appears. */
  private buildSlaChart(): void {
    const canvas = this.slaCanvas()?.nativeElement;
    if (this.slaChart !== undefined || canvas === undefined) {
      return;
    }
    const rows = this.slaStats();
    this.slaChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [
          {
            data: rows.map((row) => row.count),
            backgroundColor: SLA_BUCKETS.map((bucket) => this.cssColor(bucket.token)),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  /** Same estado→token mapping as the list/detail tags; non-canonical values take the neutral token. */
  private estadoToken(estado: string): string {
    switch (estado) {
      case 'Por hacer':
        return '--color-primary-500';
      case 'En curso':
        return '--color-primary-700';
      case 'En revisión':
        return '--color-warn';
      case 'Finalizado':
        return '--color-green-700';
      default:
        return '--color-gray-500';
    }
  }

  /** Canvas fills can't resolve var() strings, so tokens are read computed at chart-build time. */
  private cssColor(token: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }

  /** Local calendar-day equality, midnight to midnight in the browser timezone. */
  private isSameLocalDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  /** Tally records by a categorical field over the loaded data. */
  private countBy(field: 'estado' | 'prioridad'): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const incident of this.data()) {
      const key = incident[field];
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  /** Entries in canonical order, one per value actually present (zero-count values are skipped). */
  private buildStats<T extends string>(
    order: readonly T[],
    field: 'estado' | 'prioridad',
  ): StatBar<T>[] {
    const counts = this.countBy(field);
    const total = this.total();
    const bars: StatBar<T>[] = [];
    for (const label of order) {
      const count = counts[label] ?? 0;
      if (count === 0) {
        continue;
      }
      bars.push({ label, count, percent: Math.round((count / total) * 100) });
    }
    return bars;
  }
}
