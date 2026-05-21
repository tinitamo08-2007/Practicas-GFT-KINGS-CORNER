import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="text-align:center; margin-top: 50px; font-family: Arial, sans-serif;">
      <h1>Plataforma de Triaje de Incidentes</h1>
      <p>Estado de la conexión con el Backend:</p>
      <div style="padding: 20px; background-color: #f0f0f0; display: inline-block; border-radius: 8px;">
        <h2 style="color: green;">{{ mensajeDesdeBackend }}</h2>
      </div>
    </div>
  `
})
export class AppComponent implements OnInit {
  mensajeDesdeBackend = 'Cargando datos del cerebro de la app...';

  ngOnInit() {
    // Recuerda usar aquí tu IP o localhost según probaste antes
    fetch('http://localhost:3000/api/prueba')
      .then(response => response.json())
      .then(data => {
        // CORRECCIÓN AQUÍ: Debe ser exactamente "mensajeDesdeBackend"
        this.mensajeDesdeBackend = data.mensaje;
      })
      .catch(error => {
        this.mensajeDesdeBackend = 'Error al conectar con el Backend ❌';
        console.error(error);
      });
  }
}
