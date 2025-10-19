import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MusicPlayerService {
  
  // Método para que los componentes soliciten reproducir una canción
  // Esto ejecutará skipToNext() en el layout
  playTrack(track: any, establecimientoId: number) {
    console.log('🎵 MusicPlayerService: Solicitando skip para reproducir:', track.titulo);
    
    // Emitir evento para que el layout ejecute skipToNext()
    const customEvent = new CustomEvent('musicPlayerSkipRequest', {
      detail: { track, establecimientoId }
    });
    window.dispatchEvent(customEvent);
  }
}
