import { Injectable } from '@angular/core';
import { PlaybackService } from './playback.service';
import { SpotifyService } from './spotify.service';
import { MusicaSocketService } from './musica-socket.service';
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
    private spotifyService: SpotifyService,
    private musicaSocketService: MusicaSocketService
  ) {}

  /**
   * Inicializa el gestor de cola
   */
  async initialize(establecimientoId: number): Promise<void> {
    this.establecimientoId = establecimientoId;

    this.playbackService.playbackState$.subscribe(state => {
      if (state.currentTrack && state.isPlaying) {
        this.isPlaying = true;
        this.hasStartedPlaying = true;
        this.lastPosition = state.position;
      }
    });

    this.musicaSocketService.on('playback_update', async (data: any) => {
      if (data.currentTrack && data.establecimientoId === this.establecimientoId) {
        const newTrackColaId = data.currentTrack.cola_id || data.currentTrack.id;
        
        if (newTrackColaId && newTrackColaId !== this.currentQueueItemId) {
          this.currentQueueItemId = newTrackColaId;
          this.hasStartedPlaying = false;
          this.lastPosition = 0;
          
          const track: SpotifyTrack = {
            spotify_id: data.currentTrack.spotify_id,
            titulo: data.currentTrack.titulo,
            artista: data.currentTrack.artista,
            album: data.currentTrack.album,
            duracion: data.currentTrack.duracion,
            imagen_url: data.currentTrack.imagen_url,
            genero: data.currentTrack.genero,
            preview_url: data.currentTrack.preview_url
          };
          
          await this.playbackService.playTrack(data.currentTrack.spotify_id, track);
        }
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
      
      if (!state.isPlaying && 
          state.position === 0 && 
          this.isPlaying && 
          this.lastPosition > 1000 &&
          this.currentQueueItemId) {
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
    if (this.isRestoring) {
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent('trackChanging', { detail: { automatic: true } }));
      
      if (this.currentQueueItemId) {
        await this.spotifyService.moveToHistory(this.currentQueueItemId).toPromise();
        this.currentQueueItemId = null;
      }

      await this.playNextInQueue();
    } catch (error) {
      console.error('Error handling song end:', error);
      window.dispatchEvent(new CustomEvent('trackChangeFailed'));
    }
  }

  /**
   * Salta a la siguiente canción (usado para skip automático por votos)
   */
  async skipToNext(): Promise<void> {
    await this.onSongEnded();
  }

  /**
   * Reproduce la siguiente canción en la cola
   */
  async playNextInQueue(): Promise<void> {
    if (!this.establecimientoId) {
      console.error('No establecimiento ID available');
      return;
    }

    try {
      const response = await this.spotifyService.getQueue(this.establecimientoId).toPromise();
      
      if (response?.success && response.queue.length > 0) {
        const nextSong = response.queue[0];
        
        await this.spotifyService.setCurrentPlaying(nextSong.id, this.establecimientoId).toPromise();
        this.currentQueueItemId = nextSong.id;
        this.hasStartedPlaying = false;
        this.lastPosition = 0;

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

        await this.playbackService.playTrack(nextSong.spotify_id, track);

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('queueUpdated'));
          window.dispatchEvent(new CustomEvent('spotifyTrackPlayed', { detail: track }));
        }, 0);
      }
    } catch (error) {
      console.error('Error playing next song:', error);
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
    this.currentQueueItemId = queueItemId;
    this.hasStartedPlaying = false;
    this.lastPosition = 0;
  }

  /**
   * ✅ NUEVO: Activar modo restauración (desactiva la lógica automática)
   */
  setRestoringMode(isRestoring: boolean): void {
    this.isRestoring = isRestoring;
  }
}

