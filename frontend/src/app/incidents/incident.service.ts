import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Incident } from './incident.model';

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly http = inject(HttpClient);

  getIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>('/Mockincidencias.json').pipe(
      catchError((err) => {
        console.error('Failed to load incidents', err);
        return of<Incident[]>([]);
      }),
    );
  }
}
