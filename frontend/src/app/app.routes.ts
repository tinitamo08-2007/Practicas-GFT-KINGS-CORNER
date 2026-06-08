import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'incidents',
    loadComponent: () =>
      import('./incidents/incident-list/incident-list').then((m) => m.IncidentList),
  },
  {
    path: 'incidents/:codigo',
    loadComponent: () =>
      import('./incidents/incident-detail/incident-detail').then((m) => m.IncidentDetail),
  },
  {
    path: 'estadisticas',
    loadComponent: () => import('./estadisticas/estadisticas').then((m) => m.Estadisticas),
  },
];
