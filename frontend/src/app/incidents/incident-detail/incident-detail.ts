import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Incident, SugerenciaIA } from '../incident.model';
import { IncidentLoadStatus, IncidentService } from '../incident.service';

/**
 * TODO(equipo): no user system exists yet — replace when real auth lands. Under decision (c)
 * this is both the assignee written by TOMAR SUGERENCIA and the person-of-record accepting the AI.
 */
export const USUARIO_ACTUAL = 'Técnico de soporte';

/** TOMAR SUGERENCIA phases: 'error-patch' = the PUT succeeded but the PATCH failed (retry only the PATCH). */
type TomarSugerenciaPhase = 'idle' | 'saving' | 'error-put' | 'error-patch';
type EditarSugerenciaPhase = 'idle' | 'saving' | 'error';

@Component({
  selector: 'app-incident-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './incident-detail.html',
  styleUrl: './incident-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentDetail {
  private readonly service = inject(IncidentService);

  /** Bound from the `:codigo` route param via withComponentInputBinding(). */
  readonly codigo = input.required<string>();

  protected readonly incidents = toSignal(this.service.getIncidents(), {
    initialValue: [] as Incident[],
  });

  /** 'loading' until the shared fetch resolves; lets us tell loading / not-found / error apart. */
  protected readonly status = toSignal(this.service.getLoadStatus(), {
    initialValue: 'loading' as IncidentLoadStatus,
  });

  protected readonly incident = computed(() =>
    this.incidents().find((i) => i.codigo === this.codigo()),
  );

  protected readonly tomarSugerenciaPhase = signal<TomarSugerenciaPhase>('idle');
  protected readonly editarSugerenciaPhase = signal<EditarSugerenciaPhase>('idle');
  protected readonly editarSugerenciaAbierto = signal(false);
  protected readonly motivo = signal('');

  /** One mutation in flight at a time: every action control disables while either saves. */
  protected readonly accionEnCurso = computed(
    () => this.tomarSugerenciaPhase() === 'saving' || this.editarSugerenciaPhase() === 'saving',
  );

  protected estadoTagClass(estado: string): string {
    switch (estado) {
      case 'Por hacer':
        return 'tag-por-hacer';
      case 'En curso':
        return 'tag-en-curso';
      case 'En revisión':
        return 'tag-en-revision';
      case 'Finalizado':
        return 'tag-finalizado';
      default:
        return 'tag-otro';
    }
  }

  protected prioridadTagClass(prioridad: Incident['prioridad']): string {
    switch (prioridad) {
      case 'Critica':
        return 'tag-critical';
      case 'Alta':
        return 'tag-high';
      case 'Media':
        return 'tag-medium';
      case 'Baja':
        return 'tag-low';
    }
  }

  /** The AI text carries its own "1." numbering, so the template list renders without markers. */
  protected pasosResolucion(pasos: string): string[] {
    return pasos
      .split('\n')
      .map((paso) => paso.trim())
      .filter((paso) => paso !== '');
  }

  protected escaladoLabel(sugerencia: SugerenciaIA): string {
    if (!sugerencia.escalado_recomendado) {
      return 'No';
    }
    return sugerencia.nivel_escalado ? `Sí — ${sugerencia.nivel_escalado}` : 'Sí';
  }

  protected setMotivo(value: string): void {
    this.motivo.set(value);
  }

  protected editarSugerencia(): void {
    this.editarSugerenciaAbierto.update((open) => !open);
  }

  /**
   * TOMAR SUGERENCIA = accept-and-take (decision (c)): PUT estado/asignado, then PATCH aceptada, then ONE
   * refresh() after both succeed. After 'error-patch' the PUT is already applied on the server,
   * so the retry re-runs only the PATCH — never a second PUT.
   */
  protected async tomarSugerencia(): Promise<void> {
    const incident = this.incident();
    if (!incident || this.accionEnCurso()) {
      return;
    }
    const soloPatch = this.tomarSugerenciaPhase() === 'error-patch';
    this.tomarSugerenciaPhase.set('saving');
    if (!soloPatch) {
      try {
        await firstValueFrom(
          this.service.actualizarIncidencia(incident.id, {
            estado: 'En curso',
            asignado_a: USUARIO_ACTUAL,
          }),
        );
      } catch {
        this.tomarSugerenciaPhase.set('error-put');
        return;
      }
    }
    try {
      await firstValueFrom(
        this.service.revisarSugerencia(incident.id, { aceptada: true, motivo_rechazo: null }),
      );
    } catch {
      this.tomarSugerenciaPhase.set('error-patch');
      return;
    }
    this.tomarSugerenciaPhase.set('idle');
    this.editarSugerenciaPhase.set('idle');
    this.service.refresh();
  }

  /** The dissent path — the only place aceptada is set false; the motivo travels with it. */
  protected async enviarEdicion(): Promise<void> {
    const incident = this.incident();
    const texto = this.motivo().trim();
    if (!incident || texto === '' || this.accionEnCurso()) {
      return;
    }
    this.editarSugerenciaPhase.set('saving');
    try {
      await firstValueFrom(
        this.service.revisarSugerencia(incident.id, { aceptada: false, motivo_rechazo: texto }),
      );
    } catch {
      this.editarSugerenciaPhase.set('error');
      return;
    }
    this.editarSugerenciaPhase.set('idle');
    this.tomarSugerenciaPhase.set('idle');
    this.editarSugerenciaAbierto.set(false);
    this.motivo.set('');
    this.service.refresh();
  }
}
