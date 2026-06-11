import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Incident } from '../incident.model';
import { IncidentLoadStatus, IncidentService } from '../incident.service';

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

  protected estadoTagClass(estado: string): string {
    switch (estado) {
      case 'Nueva':
        return 'tag-nueva';
      case 'En progreso':
        return 'tag-in-progress';
      case 'Resuelta':
        return 'tag-resolved';
      case 'Cancelada':
        return 'tag-cancelled';
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
}
