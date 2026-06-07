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
];
