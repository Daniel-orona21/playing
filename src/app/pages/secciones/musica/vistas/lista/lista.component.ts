import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Cancion {
  id: number;
  nombre: string;
  artista: string;
  duracion?: string;
  album?: string;
  year?: number;
}

@Component({
  selector: 'app-lista',
  imports: [CommonModule],
  templateUrl: './lista.component.html',
  styleUrl: './lista.component.scss'
})
export class ListaComponent {
  // Lista de canciones "A continuación"
  aContinuacion: Cancion[] = [
    { id: 1, nombre: 'Cancion 24', artista: 'Artista de prueba', duracion: '3:45', album: 'Album 1', year: 2024 },
    { id: 2, nombre: 'Cancion 25', artista: 'Artista de prueba', duracion: '4:12', album: 'Album 1', year: 2024 },
    { id: 3, nombre: 'Cancion 26', artista: 'Artista de prueba', duracion: '3:28', album: 'Album 2', year: 2024 },
    { id: 4, nombre: 'Cancion 27', artista: 'Artista de prueba', duracion: '4:33', album: 'Album 2', year: 2024 },
    { id: 5, nombre: 'Cancion 28', artista: 'Artista de prueba', duracion: '3:15', album: 'Album 3', year: 2024 },
    { id: 6, nombre: 'Cancion 29', artista: 'Artista de prueba', duracion: '4:01', album: 'Album 3', year: 2024 },
    { id: 7, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 },
    { id: 8, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 },
    { id: 9, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 }
  ];

  // Lista de canciones del historial
  historial: Cancion[] = [
    { id: 8, nombre: 'Cancion 17', artista: 'Artista de prueba', duracion: '3:20', album: 'Album 1', year: 2024 },
    { id: 9, nombre: 'Cancion 18', artista: 'Artista de prueba', duracion: '4:05', album: 'Album 1', year: 2024 },
    { id: 10, nombre: 'Cancion 19', artista: 'Artista de prueba', duracion: '3:45', album: 'Album 2', year: 2024 },
    { id: 11, nombre: 'Cancion 20', artista: 'Artista de prueba', duracion: '3:38', album: 'Album 2', year: 2024 },
    { id: 12, nombre: 'Cancion 21', artista: 'Artista de prueba', duracion: '4:15', album: 'Album 3', year: 2024 },
    { id: 13, nombre: 'Cancion 22', artista: 'Artista de prueba', duracion: '3:30', album: 'Album 3', year: 2024 },
    { id: 14, nombre: 'Cancion 23', artista: 'Artista de prueba', duracion: '3:55', album: 'Album 4', year: 2024 }
  ];

  // Índice de la canción con menú abierto en "A continuación"
  menuAbierto: number | null = null;

  eliminarCancion(index: number) {
    this.aContinuacion.splice(index, 1);
    // Cerrar el menú después de eliminar
    this.menuAbierto = null;
  }

  abrirMenu(index: number, event: Event) {
    event.stopPropagation();
    this.menuAbierto = this.menuAbierto === index ? null : index;
  }

  cerrarMenu() {
    this.menuAbierto = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Cerrar el menú si se hace click fuera de él
    if (this.menuAbierto !== null) {
      this.cerrarMenu();
    }
  }
}
