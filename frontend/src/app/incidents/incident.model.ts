export type IncidentEstado =
  | 'Nueva'
  | 'Asignada'
  | 'En progreso'
  | 'Pendiente'
  | 'Resuelta'
  | 'Cerrada';

export type IncidentPrioridad = 'Critica' | 'Alta' | 'Media' | 'Baja';

export interface Incident {
  id: number;
  codigo: string;
  jiraId: string | null;
  titulo: string;
  descripcion: string;
  estado: IncidentEstado;
  prioridad: IncidentPrioridad;
  categoria: string;
  reportadoPor: string;
  asignadoA: string | null;
  equipo: string | null;
  origen: string;
  causa: string | null;
  solucion: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  fechaCierre: string | null;
  slaVencimiento: string;
}
