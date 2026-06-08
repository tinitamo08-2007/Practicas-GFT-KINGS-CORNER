import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { IncidentEstado, IncidentPrioridad } from '../incidents/incident.model';
import { IncidentService } from '../incidents/incident.service';

/** Canonical display order per dimension: estado by lifecycle, prioridad by severity. */
const ESTADO_ORDER: readonly IncidentEstado[] = ['En progreso', 'Resuelta', 'Cancelada'];
const PRIORIDAD_ORDER: readonly IncidentPrioridad[] = ['Critica', 'Alta', 'Media', 'Baja'];

/** One horizontal bar: a value label with its record count and rounded percentage of the total. */
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

  /** No initialValue on purpose: undefined = loading, [] = empty ("Sin datos"), non-empty = content. */
  protected readonly data = toSignal(this.service.getIncidents());

  protected readonly total = computed(() => this.data()?.length ?? 0);

  protected readonly estadoStats = computed(() => this.buildStats(ESTADO_ORDER, 'estado'));
  protected readonly prioridadStats = computed(() => this.buildStats(PRIORIDAD_ORDER, 'prioridad'));

  protected readonly resumen = computed(() => {
    const counts = this.countBy('estado');
    return {
      total: this.total(),
      enProgreso: counts['En progreso'] ?? 0,
      resueltas: counts['Resuelta'] ?? 0,
      canceladas: counts['Cancelada'] ?? 0,
    };
  });

  protected estadoColor(estado: IncidentEstado): string {
    switch (estado) {
      case 'En progreso':
        return 'var(--color-primary-700)';
      case 'Resuelta':
        return 'var(--color-green-700)';
      case 'Cancelada':
        return 'var(--color-gray-300)';
    }
  }

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

  /** Tally records by a categorical field over the loaded data. */
  private countBy(field: 'estado' | 'prioridad'): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const incident of this.data() ?? []) {
      const key = incident[field];
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  /** Bars in canonical order, one per value actually present (zero-count values are skipped). */
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
