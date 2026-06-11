import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Incident, IncidentEstado, IncidentPrioridad } from '../incident.model';
import { IncidentLoadStatus, IncidentService } from '../incident.service';

/** Value of the Equipo select's "Sin asignar" option; matches incidents whose equipo is null. */
const SIN_ASIGNAR = '__SIN_ASIGNAR__';

@Component({
  selector: 'app-incident-list',
  imports: [DatePipe, RouterLink],
  templateUrl: './incident-list.html',
  styleUrl: './incident-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentList {
  private readonly service = inject(IncidentService);

  protected readonly SIN_ASIGNAR = SIN_ASIGNAR;

  protected readonly incidents = toSignal(this.service.getIncidents(), {
    initialValue: [] as Incident[],
  });

  protected readonly status = toSignal(this.service.getLoadStatus(), {
    initialValue: 'loading' as IncidentLoadStatus,
  });

  protected readonly searchTerm = signal('');
  protected readonly estadoFilter = signal<IncidentEstado | ''>('');
  protected readonly prioridadFilter = signal<IncidentPrioridad | ''>('');
  protected readonly equipoFilter = signal<string>('');

  protected readonly equipoOptions = computed(() => {
    const teams = new Set<string>();
    for (const incident of this.incidents()) {
      if (incident.equipo !== null) {
        teams.add(incident.equipo);
      }
    }
    return [...teams].sort();
  });

  protected readonly filtered = computed(() => {
    const term = this.normalize(this.searchTerm().trim());
    const estado = this.estadoFilter();
    const prioridad = this.prioridadFilter();
    const equipo = this.equipoFilter();

    return this.incidents().filter((incident) => {
      const matchesSearch =
        term === '' ||
        this.normalize(incident.codigo).includes(term) ||
        this.normalize(incident.titulo).includes(term);
      const matchesEstado = estado === '' || incident.estado === estado;
      const matchesPrioridad = prioridad === '' || incident.prioridad === prioridad;
      const matchesEquipo =
        equipo === '' ||
        (equipo === SIN_ASIGNAR ? incident.equipo === null : incident.equipo === equipo);

      return matchesSearch && matchesEstado && matchesPrioridad && matchesEquipo;
    });
  });

  protected setEstado(value: string): void {
    this.estadoFilter.set(value as IncidentEstado | '');
  }

  protected setPrioridad(value: string): void {
    this.prioridadFilter.set(value as IncidentPrioridad | '');
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.estadoFilter.set('');
    this.prioridadFilter.set('');
    this.equipoFilter.set('');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

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
}
