import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <div class="not-found__card">
        <p class="not-found__code">404</p>
        <h1 class="not-found__title">Página no encontrada</h1>
        <p class="not-found__text">
          La página que buscas no existe o se movió a otra dirección.
        </p>
        <a class="not-found__home" routerLink="/incidents">Volver a incidencias</a>
      </div>
    </section>
  `,
  styleUrl: './not-found.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
