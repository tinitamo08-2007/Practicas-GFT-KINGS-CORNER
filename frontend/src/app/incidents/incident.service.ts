import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Incident } from './incident.model';

export type IncidentLoadStatus = 'loading' | 'error' | 'success';

/** Envelope over the shared fetch so consumers can tell a load failure apart from an empty dataset. */
interface IncidentLoad {
  status: 'error' | 'success';
  incidents: Incident[];
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/incidencias`;

  /** Re-fetch trigger; emits once on creation, so the initial load is still exactly one GET. */
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  /**
   * Single shared fetch behind the refresh trigger: the first subscriber triggers the GET,
   * later subscribers replay it, and refresh() re-runs it once for every subscriber.
   * catchError stays on the inner GET — on the outer pipe it would complete the shared
   * stream on the first failure and refresh() would stop working.
   */
  private readonly load$ = this.refresh$.pipe(
    switchMap(() =>
      this.http.get<Incident[]>(this.baseUrl).pipe(
        map((incidents): IncidentLoad => ({ status: 'success', incidents })),
        catchError((err): Observable<IncidentLoad> => {
          console.error('No se pudieron cargar las incidencias', err);
          return of<IncidentLoad>({ status: 'error', incidents: [] });
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** Both accessors derive from the one shared load$, so list + detail + stats share a single GET. */
  private readonly incidents$ = this.load$.pipe(map((load) => load.incidents));
  private readonly status$ = this.load$.pipe(map((load) => load.status));

  getIncidents(): Observable<Incident[]> {
    return this.incidents$;
  }

  getLoadStatus(): Observable<IncidentLoadStatus> {
    return this.status$;
  }

  /** Re-runs the shared GET once; the new array multicasts to list, detail, and estadísticas. */
  refresh(): void {
    this.refresh$.next(undefined);
  }

  /** Thin PUT — callers orchestrate sequencing and the single explicit refresh(). */
  actualizarIncidencia(
    id: number,
    cambios: { estado: string; asignado_a: string },
  ): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/${id}`, cambios);
  }

  /** Thin PATCH — the technician's accept/reject decision on the AI suggestion. */
  revisarSugerencia(
    id: number,
    revision: { aceptada: boolean; motivo_rechazo: string | null },
  ): Observable<unknown> {
    return this.http.patch<unknown>(`${this.baseUrl}/${id}/sugerencia`, revision);
  }
}
