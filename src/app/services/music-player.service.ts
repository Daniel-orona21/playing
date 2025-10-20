import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MusicPlayerService {
  
  // Método para que los componentes soliciten reproducir una canción
  // Esto manejará toda la lógica de reproducción
  playTrack(track: any, establecimientoId: number) {
    console.log('🎵 MusicPlayerService: Solicitando reproducción de:', track.titulo);
    
    // Emitir evento para que el layout maneje la reproducción
    const customEvent = new CustomEvent('musicPlayerPlayRequest', {
      detail: { track, establecimientoId }
    });
    window.dispatchEvent(customEvent);
  }

  // Método específico para reproducción inicial (cuando no hay música sonando)
  // Este método NO reproduce inmediatamente, solo prepara todo
  playInitialTrack(track: any, establecimientoId: number) {
    console.log('🎵 MusicPlayerService: Preparando reproducción inicial de:', track.titulo);
    
    // Emitir evento específico para reproducción inicial
    const customEvent = new CustomEvent('musicPlayerInitialPlayRequest', {
      detail: { track, establecimientoId }
    });
    window.dispatchEvent(customEvent);
  }

}
