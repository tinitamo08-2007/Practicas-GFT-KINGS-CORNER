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
      case 'En progreso':
        return 'tag-in-progress';
      case 'Resuelta':
        return 'tag-resolved';
      case 'Cancelada':
        return 'tag-cancelled';
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
