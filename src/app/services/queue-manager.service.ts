import { Injectable } from '@angular/core';
import { PlaybackService } from './playback.service';
import { SpotifyService } from './spotify.service';
import { SpotifyTrack } from '../models/musica.interfaces';

@Injectable({
  providedIn: 'root'
})
export class QueueManagerService {
  private establecimientoId: number | null = null;
  private isPlaying = false;
  private currentQueueItemId: number | null = null;
  private checkInterval: any = null;
  private isRestoring = false; // ✅ Flag para desactivar durante restauración
  private lastPosition = 0; // ✅ Para detectar si realmente terminó
  private hasStartedPlaying = false; // ✅ Para evitar falsos positivos al inicio

  constructor(
    private playbackService: PlaybackService,
    private spotifyService: SpotifyService
  ) {}

  /**
   * Inicializa el gestor de cola
   */
  async initialize(establecimientoId: number): Promise<void> {
    console.log('🎵 QueueManager: Initializing for establecimiento', establecimientoId);
    this.establecimientoId = establecimientoId;

    // Suscribirse a cambios en el estado de reproducción
    this.playbackService.playbackState$.subscribe(state => {
      if (state.currentTrack && state.isPlaying) {
        if (!this.isPlaying) {
          console.log('🎵 QueueManager: Playback started');
        }
        this.isPlaying = true;
        this.hasStartedPlaying = true;
        this.lastPosition = state.position;
      }
    });

    // Iniciar verificación periódica del estado de reproducción
    this.startPeriodicCheck();
  }

  /**
   * Inicia la verificación periódica del estado de reproducción
   */
  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      const state = this.playbackService.getCurrentState();
      
      // Solo procesar si realmente ha empezado a reproducir algo
      if (!this.hasStartedPlaying) {
        return;
      }

      // Si está reproduciendo, actualizar la posición
      if (state.isPlaying && state.position > 0) {
        this.lastPosition = state.position;
        this.isPlaying = true;
      }
      
      // Si la canción está cerca del final (últimos 2 segundos)
      if (state.isPlaying && state.duration > 0) {
        const timeRemaining = state.duration - state.position;
        if (timeRemaining <= 2000 && timeRemaining > 0) {
          console.log('🎵 QueueManager: Song is about to end, preparing next song');
        }
      }

      // ✅ Detectar fin de canción: debe cumplir TODAS estas condiciones
      if (!state.isPlaying && 
          state.position === 0 && 
          this.isPlaying && 
          this.lastPosition > 1000 && // La canción debe haber avanzado al menos 1 segundo
          this.currentQueueItemId) {   // Debe haber una canción actual
        
        console.log('🎵 QueueManager: Detected song end (position was', this.lastPosition, ')');
        this.isPlaying = false;
        this.hasStartedPlaying = false;
        this.lastPosition = 0;
        this.onSongEnded();
      }
    }, 1000); // Verificar cada segundo
  }

  /**
   * Maneja el evento cuando una canción termina
   */
  private async onSongEnded(): Promise<void> {
    // ✅ No hacer nada si estamos restaurando
    if (this.isRestoring) {
      console.log('🎵 QueueManager: Skipping onSongEnded (restoring)');
      return;
    }

    console.log('🎵 QueueManager: Song ended, getting next song from queue');

    try {
      // Mover la canción actual al historial
      if (this.currentQueueItemId) {
        console.log('🎵 QueueManager: Moving current song to history:', this.currentQueueItemId);
        await this.spotifyService.moveToHistory(this.currentQueueItemId).toPromise();
        this.currentQueueItemId = null;
      }

      // Obtener la siguiente canción de la cola
      await this.playNextInQueue();
    } catch (error) {
      console.error('🎵 QueueManager: Error handling song end:', error);
    }
  }

  /**
   * Reproduce la siguiente canción en la cola
   */
  async playNextInQueue(): Promise<void> {
    if (!this.establecimientoId) {
      console.error('🎵 QueueManager: No establecimiento ID available');
      return;
    }

    try {
      // Obtener la cola
      const response = await this.spotifyService.getQueue(this.establecimientoId).toPromise();
      
      if (response?.success && response.queue.length > 0) {
        const nextSong = response.queue[0]; // Primera canción pendiente
        
        console.log('🎵 QueueManager: Playing next song:', nextSong.titulo);

        // Usar el nuevo endpoint que marca como playing (y mueve las anteriores al historial)
        await this.spotifyService.setCurrentPlaying(nextSong.id, this.establecimientoId).toPromise();
        this.currentQueueItemId = nextSong.id;
        // Reset flags para la nueva canción
        this.hasStartedPlaying = false;
        this.lastPosition = 0;

        // Crear objeto SpotifyTrack
        const track: SpotifyTrack = {
          spotify_id: nextSong.spotify_id,
          titulo: nextSong.titulo,
          artista: nextSong.artista,
          album: nextSong.album,
          duracion: nextSong.duracion,
          imagen_url: nextSong.imagen_url,
          genero: nextSong.genero,
          preview_url: nextSong.preview_url
        };

        // Reproducir la canción
        await this.playbackService.playTrack(nextSong.spotify_id, track);

        // Emitir evento para que otros componentes actualicen
        window.dispatchEvent(new CustomEvent('queueUpdated'));
        window.dispatchEvent(new CustomEvent('spotifyTrackPlayed', { detail: track }));

        console.log('🎵 QueueManager: Successfully started playing next song');
      } else {
        console.log('🎵 QueueManager: No more songs in queue');
      }
    } catch (error) {
      console.error('🎵 QueueManager: Error playing next song:', error);
    }
  }

  /**
   * Detiene el gestor de cola
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.establecimientoId = null;
    this.currentQueueItemId = null;
    this.isPlaying = false;
    this.hasStartedPlaying = false;
    this.lastPosition = 0;
  }

  /**
   * Establece el ID del elemento actual de la cola
   */
  setCurrentQueueItem(queueItemId: number): void {
    console.log('🎵 QueueManager: Setting current queue item:', queueItemId);
    this.currentQueueItemId = queueItemId;
    // Reset flags cuando se establece una nueva canción
    this.hasStartedPlaying = false;
    this.lastPosition = 0;
  }

  /**
   * ✅ NUEVO: Activar modo restauración (desactiva la lógica automática)
   */
  setRestoringMode(isRestoring: boolean): void {
    this.isRestoring = isRestoring;
    console.log(`🎵 QueueManager: Restoring mode ${isRestoring ? 'ENABLED' : 'DISABLED'}`);
  }
}

