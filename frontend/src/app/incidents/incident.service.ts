import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

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

  /** Single shared fetch: the first subscriber triggers the GET, later subscribers replay it. */
  private readonly load$ = this.http
    .get<Incident[]>(`${environment.apiBaseUrl}/api/incidencias`)
    .pipe(
      map((incidents): IncidentLoad => ({ status: 'success', incidents })),
      catchError((err): Observable<IncidentLoad> => {
        console.error('No se pudieron cargar las incidencias', err);
        return of<IncidentLoad>({ status: 'error', incidents: [] });
      }),
      shareReplay(1),
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
}
