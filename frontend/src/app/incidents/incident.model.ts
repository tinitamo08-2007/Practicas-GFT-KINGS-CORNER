/** The four canonical estado values, in lifecycle order. The backend may emit others. */
export type IncidentEstado = 'Nueva' | 'En progreso' | 'Resuelta' | 'Cancelada';

/** Canonical estados in lifecycle order — drives the filter dropdown and the Estadísticas ordering. */
export const CANONICAL_ESTADOS: readonly IncidentEstado[] = [
  'Nueva',
  'En progreso',
  'Resuelta',
  'Cancelada',
];

export type IncidentPrioridad = 'Critica' | 'Alta' | 'Media' | 'Baja';

/** The nested AI analysis (`sugerencia_ia` on the wire). Typed to match the backend; not rendered this cycle. */
export interface SugerenciaIA {
  id: number;
  categoria_sugerida: string;
  prioridad_sugerida: string;
  tiempo_sugerido: string;
  descripcion_mejorada: string;
  pasos_resolucion: string;
  causa_probable: string | null;
  subcategoria: string | null;
  impacto: string | null;
  escalado_recomendado: boolean;
  nivel_escalado: string | null;
  etiquetas: string[];
  aceptada: boolean | null;
  motivo_rechazo: string | null;
  creada_en: string;
}

export interface Incident {
  id: number;
  codigo: string;
  jira_id: string | null;
  titulo: string;
  descripcion: string;
  /** Tolerant: the canonical four plus any other value the backend/Jira may emit. */
  estado: string;
  prioridad: IncidentPrioridad;
  categoria: string | null;
  reportado_por: string;
  asignado_a: string | null;
  equipo: string | null;
  origen: string;
  causa: string | null;
  solucion: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  fecha_cierre: string | null;
  sla_vencimiento: string | null;
  sugerencia_ia: SugerenciaIA | null;
}
