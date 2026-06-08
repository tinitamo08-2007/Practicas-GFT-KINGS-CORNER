import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { Incident } from './incident.model';

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly http = inject(HttpClient);

  /** Single shared fetch: the first subscriber triggers the GET, later subscribers replay it. */
  private readonly incidents$ = this.http.get<Incident[]>('/Mockincidencias.json').pipe(
    catchError((err) => {
      console.error('Failed to load incidents', err);
      return of<Incident[]>([]);
    }),
    shareReplay(1),
  );

  getIncidents(): Observable<Incident[]> {
    return this.incidents$;
  }
}
