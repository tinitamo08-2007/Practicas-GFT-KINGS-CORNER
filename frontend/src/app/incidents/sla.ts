import { Incident } from './incident.model';

/** Boundary between "A punto de vencer" and "Dentro de plazo": 4 hours, in milliseconds. */
export const SLA_WARNING_THRESHOLD_MS = 4 * 60 * 60 * 1000;

export type SlaBucket = 'vencida' | 'a-punto' | 'dentro';

/**
 * Single source of truth for SLA bucket classification (the estadísticas SLA
 * chart consumes the same semantics next cycle). Pure: `nowMs` is a parameter
 * so the function never reads the clock itself.
 *
 * Returns `null` when the incident has no live deadline — `estado` Finalizado
 * or `sla_vencimiento` null — meaning it belongs to no bucket.
 */
export function slaBucket(
  incident: Pick<Incident, 'estado' | 'sla_vencimiento'>,
  nowMs: number,
): SlaBucket | null {
  if (incident.estado === 'Finalizado' || incident.sla_vencimiento === null) {
    return null;
  }
  const remaining = Date.parse(incident.sla_vencimiento) - nowMs;
  if (remaining < 0) {
    return 'vencida';
  }
  return remaining < SLA_WARNING_THRESHOLD_MS ? 'a-punto' : 'dentro';
}
