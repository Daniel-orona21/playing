import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-juego',
  imports: [CommonModule],
  templateUrl: './juego.component.html',
  styleUrl: './juego.component.scss'
})
export class JuegoComponent {
  juegoIniciado = false;

  toggleJuego() {
    this.juegoIniciado = !this.juegoIniciado;
  }

}
