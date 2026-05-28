import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Incident } from '../incident.model';
import { IncidentService } from '../incident.service';

@Component({
  selector: 'app-incident-list',
  imports: [AsyncPipe, DatePipe],
  templateUrl: './incident-list.html',
  styleUrl: './incident-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentList {
  private readonly service = inject(IncidentService);

  protected readonly incidents$ = this.service.getIncidents();

  protected estadoTagClass(estado: Incident['estado']): string {
    switch (estado) {
      case 'Nueva':
        return 'tag-new';
      case 'Asignada':
      case 'En progreso':
        return 'tag-in-progress';
      case 'Pendiente':
        return 'tag-pending';
      case 'Resuelta':
      case 'Cerrada':
        return 'tag-resolved';
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
