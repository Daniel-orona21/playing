import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  SpotifyTrack, 
  SpotifySearchResponse, 
  SpotifyGenresResponse, 
  QueueResponse, 
  HistoryResponse, 
  CurrentTrackResponse,
  ValidationResponse 
} from '../models/musica.interfaces';

export interface SpotifyPlaybackState {
  isPlaying: boolean;
  progress: number;
  device: any;
  track: SpotifyTrack | null;
}

export interface SpotifyCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
}

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {
  private readonly API_URL = `${environment.apiUrl}/spotify`;
  private player: any = null;
  private deviceId: string | null = null;
  
  // Estados
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();
  
  private playbackStateSubject = new BehaviorSubject<SpotifyPlaybackState | null>(null);
  public playbackState$ = this.playbackStateSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Inicializar el SDK de Spotify
  async initializePlayer(establecimientoId: number): Promise<void> {
    try {
      console.log('Initializing Spotify player for establishment:', establecimientoId);
      
      // Verificar si el SDK ya está cargado
      if (!(window as any).Spotify) {
        console.log('Loading Spotify SDK...');
        await this.loadSpotifySDK();
      }

      const credentials = await this.getCredentials(establecimientoId);
      if (!credentials) {
        throw new Error('No hay credenciales de Spotify disponibles');
      }

      console.log('Creating Spotify player instance...');
      this.player = new (window as any).Spotify.Player({
        name: 'Playing Music App',
        getOAuthToken: (cb: (token: string) => void) => {
          console.log('Getting OAuth token for playback');
          cb(credentials.accessToken);
        },
        volume: 0.5
      });

      // Event listeners
      this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player ready with Device ID:', device_id);
        this.deviceId = device_id;
        this.isConnectedSubject.next(true);
        console.log('Device registered successfully and connection status updated');
        
        // Emitir evento personalizado cuando el dispositivo esté listo
        const deviceReadyEvent = new CustomEvent('spotifyDeviceReady', { 
          detail: { deviceId: device_id } 
        });
        window.dispatchEvent(deviceReadyEvent);
        console.log('Device ready event dispatched');
      });

      this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device ID has gone offline:', device_id);
        this.deviceId = null;
        this.isConnectedSubject.next(false);
      });

      this.player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Failed to initialize Spotify player:', message);
        this.isConnectedSubject.next(false);
      });

      this.player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Failed to authenticate with Spotify:', message);
        this.isConnectedSubject.next(false);
      });

      this.player.addListener('account_error', ({ message }: { message: string }) => {
        console.error('Failed to validate Spotify account:', message);
        this.isConnectedSubject.next(false);
      });

      this.player.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('Spotify playback error:', message);
      });

      this.player.addListener('player_state_changed', (state: any) => {
        if (state) {
          console.log('Player state changed:', state);
          
          // Solo actualizar si hay información de la canción actual
          const currentTrack = state.track_window?.current_track;
          if (currentTrack) {
            console.log('Current track info:', currentTrack);
            const playbackState = {
              isPlaying: !state.paused,
              progress: state.position,
              device: state.device,
              track: {
                spotify_id: currentTrack.id,
                titulo: currentTrack.name,
                artista: currentTrack.artists[0]?.name || 'Unknown',
                album: currentTrack.album.name,
                duracion: Math.floor(currentTrack.duration_ms / 1000),
                imagen_url: currentTrack.album.images[0]?.url || '',
                genero: undefined,
                preview_url: currentTrack.preview_url
              }
            };
            console.log('Emitting playback state:', playbackState);
            this.playbackStateSubject.next(playbackState);
          } else {
            console.log('No current track info available, keeping current state');
            // No actualizar el estado si no hay información de la canción
            // para evitar perder la información que ya tenemos
          }
        }
      });

      // Conectar el reproductor
      console.log('Connecting Spotify player...');
      const success = await this.player.connect();
      if (success) {
        console.log('Spotify player connected successfully');
        console.log('Device registration will be handled by the ready event listener');
      } else {
        throw new Error('No se pudo conectar el reproductor de Spotify');
      }

    } catch (error) {
      console.error('Error initializing Spotify player:', error);
      this.isConnectedSubject.next(false);
      throw error;
    }
  }

  // Cargar el SDK de Spotify
  private loadSpotifySDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).Spotify) {
        resolve();
        return;
      }

      (window as any).onSpotifyWebPlaybackSDKReady = () => {
        console.log('Spotify Web Playback SDK ready');
        resolve();
      };

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
      document.head.appendChild(script);
    });
  }

  // Conectar con Spotify para establecimiento
  async connect(establecimientoId: number): Promise<void> {
    try {
      const response = await this.http.get<any>(`${environment.apiUrl}/spotify-establecimiento/auth?establecimientoId=${establecimientoId}`).toPromise();
      
      if (response.success) {
        window.location.href = response.authUrl;
      } else {
        throw new Error('Error al obtener URL de autenticación');
      }
    } catch (error: any) {
      console.error('Error connecting to Spotify:', error);
      throw error;
    }
  }

  // Manejar callback de OAuth
  async handleCallback(code: string, state: string, establecimientoId: number): Promise<void> {
    try {
      const response = await this.http.post<any>(`${environment.apiUrl}/spotify-establecimiento/callback`, {
        code,
        state
      }).toPromise();

      if (response.success) {
        console.log('Spotify callback processed successfully');
        // Inicializar el reproductor después de la autenticación exitosa
        await this.initializePlayer(establecimientoId);
      } else {
        throw new Error('Error al procesar callback de Spotify');
      }
    } catch (error: any) {
      console.error('Error handling Spotify callback:', error);
      throw error;
    }
  }

  // Debug method para verificar credenciales
  async debugCredentials(establecimientoId: number): Promise<any> {
    try {
      console.log('Debug: Getting credentials for establishment:', establecimientoId);
      const response = await this.http.get<any>(`${environment.apiUrl}/spotify-establecimiento/credentials/${establecimientoId}`).toPromise();
      console.log('Debug: Credentials response:', response);
      return response;
    } catch (error: any) {
      console.error('Debug: Error getting Spotify credentials:', error);
      return null;
    }
  }

  // Obtener credenciales del establecimiento
  async getCredentials(establecimientoId: number): Promise<SpotifyCredentials | null> {
    try {
      console.log('Getting credentials for establishment:', establecimientoId);
      const response = await this.http.get<any>(`${environment.apiUrl}/spotify-establecimiento/credentials/${establecimientoId}`).toPromise();
      console.log('Credentials response:', response);
      
      if (response.success) {
        return response.credentials;
      } else if (response.needsRefresh) {
        console.log('Token expired, refreshing...');
        // Intentar refrescar el token
        const refreshResponse = await this.refreshAccessToken(establecimientoId);
        if (refreshResponse) {
          console.log('Refresh successful, returning new credentials');
          return refreshResponse;
        } else {
          console.log('Refresh failed');
          return null;
        }
      }
      
      console.log('No credentials found in response');
      return null;
    } catch (error: any) {
      console.error('Error getting Spotify credentials:', error);
      // Si es un 401, intentar refresh
      if (error.status === 401) {
        console.log('Got 401, attempting refresh...');
        const refreshResponse = await this.refreshAccessToken(establecimientoId);
        if (refreshResponse) {
          console.log('Refresh successful after 401');
          return refreshResponse;
        }
      }
      return null;
    }
  }

  // Refrescar token de acceso
  private async refreshAccessToken(establecimientoId: number): Promise<SpotifyCredentials | null> {
    try {
      console.log('Refreshing access token for establishment:', establecimientoId);
      const response = await this.http.post<any>(`${environment.apiUrl}/spotify-establecimiento/refresh/${establecimientoId}`, {}).toPromise();
      
      if (response && response.success) {
        console.log('Token refreshed successfully');
        // Obtener las credenciales actualizadas
        const credentialsResponse = await this.http.get<any>(`${environment.apiUrl}/spotify-establecimiento/credentials/${establecimientoId}`).toPromise();
        if (credentialsResponse && credentialsResponse.success) {
          return credentialsResponse.credentials;
        }
      }
      
      return null;
    } catch (error: any) {
      console.error('Error refreshing access token:', error);
      return null;
    }
  }

  // Desconectar Spotify
  async disconnect(establecimientoId: number): Promise<void> {
    try {
      if (this.player) {
        await this.player.disconnect();
        this.player = null;
        this.deviceId = null;
      }

      await this.http.delete(`${environment.apiUrl}/spotify-establecimiento/disconnect/${establecimientoId}`).toPromise();
      
      this.isConnectedSubject.next(false);
      this.playbackStateSubject.next(null);
    } catch (error: any) {
      console.error('Error disconnecting Spotify:', error);
      throw error;
    }
  }

  // Verificar si está conectado
  isConnected(): boolean {
    return this.isConnectedSubject.value;
  }

  // Auto-inicializar reproductor si hay credenciales válidas
  async autoInitializePlayer(): Promise<boolean> {
    try {
      // Obtener el establecimiento actual del usuario
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        console.log('No current user found for auto-initialization');
        return false;
      }

      // Obtener el establecimiento del usuario con manejo de errores de autenticación
      let establecimientoResponse;
      try {
        establecimientoResponse = await this.http.get<any>(`${environment.apiUrl}/establecimientos/mio`).toPromise();
      } catch (authError: any) {
        if (authError.status === 401) {
          console.log('User not authenticated, skipping auto-initialization');
          return false;
        }
        throw authError;
      }

      if (!establecimientoResponse?.establecimiento) {
        console.log('No establishment found for auto-initialization');
        return false;
      }

      const establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
      
      // Verificar si ya está inicializado
      if (this.player && this.isConnected()) {
        console.log('Player already initialized');
        return true;
      }

      // Verificar si hay credenciales válidas
      const credentials = await this.getCredentials(establecimientoId);
      if (!credentials) {
        console.log('No valid credentials found for auto-initialization');
        return false;
      }

      // Inicializar el reproductor
      await this.initializePlayer(establecimientoId);
      console.log('Player auto-initialized successfully');
      return true;
    } catch (error) {
      console.error('Error auto-initializing player:', error);
      return false;
    }
  }

  // Verificar si Spotify está disponible
  async checkSpotifyAvailability(): Promise<boolean> {
    try {
      const credentials = await this.getCredentials(1); // Usar establecimiento 1 temporalmente
      if (!credentials) {
        return false;
      }

      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.devices && data.devices.length > 0;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking Spotify availability:', error);
      return false;
    }
  }

  // Verificar dispositivos activos de Spotify
  async checkActiveDevices(establecimientoId: number): Promise<any[]> {
    try {
      const credentials = await this.getCredentials(establecimientoId);
      if (!credentials) {
        return [];
      }

      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Active Spotify devices:', data.devices);
        return data.devices || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error checking active devices:', error);
      return [];
    }
  }

  // Obtener usuario actual (helper)
  private getCurrentUser(): any {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    console.log('Current user from localStorage:', user);
    return user;
  }

  // ===== NUEVOS MÉTODOS PARA INTEGRACIÓN DE MÚSICA =====

  // Buscar canciones
  searchTracks(query: string, establecimientoId: number): Observable<SpotifySearchResponse> {
    return this.http.get<SpotifySearchResponse>(`${environment.apiUrl}/musica/search`, {
      params: { q: query, establecimientoId: establecimientoId.toString() }
    });
  }

  // Obtener géneros disponibles
  getGenres(): Observable<SpotifyGenresResponse> {
    return this.http.get<SpotifyGenresResponse>(`${environment.apiUrl}/musica/genres`);
  }

  // Buscar canciones por género
  getTracksByGenre(genre: string, establecimientoId: number): Observable<SpotifySearchResponse> {
    return this.http.get<SpotifySearchResponse>(`${environment.apiUrl}/musica/genres/${genre}/tracks`, {
      params: { establecimientoId: establecimientoId.toString() }
    });
  }

  // Obtener cola de reproducción
  getQueue(establecimientoId: number): Observable<QueueResponse> {
    return this.http.get<QueueResponse>(`${environment.apiUrl}/musica/queue/${establecimientoId}`);
  }

  // Agregar canción a la cola
  addToQueue(track: SpotifyTrack, userId: number, establecimientoId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/musica/queue`, {
      track,
      userId,
      establecimientoId
    });
  }

  // Eliminar canción de la cola
  removeFromQueue(id: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/musica/queue/${id}`);
  }

  // Actualizar posición en la cola
  updateQueuePosition(id: number, newPosition: number): Observable<any> {
    return this.http.put(`${environment.apiUrl}/musica/queue/${id}/position`, {
      newPosition
    });
  }

  // Obtener canción actualmente reproduciéndose
  getCurrentPlaying(establecimientoId: number): Observable<CurrentTrackResponse> {
    return this.http.get<CurrentTrackResponse>(`${environment.apiUrl}/musica/playing/${establecimientoId}`);
  }

  // Reproducir canción específica usando Spotify Web Playback SDK
  async playTrack(track: SpotifyTrack, establecimientoId?: number): Promise<void> {
    try {
      console.log('Playing track:', track.titulo, 'by', track.artista);
      
      // Verificar si el reproductor está inicializado
      if (!this.player) {
        console.log('Player not initialized, attempting to initialize...');
        if (establecimientoId) {
          try {
            await this.initializePlayer(establecimientoId);
            console.log('Player initialized successfully');
          } catch (error) {
            console.error('Failed to initialize player:', error);
            throw new Error('Spotify player not initialized and could not be initialized automatically');
          }
        } else {
          throw new Error('Spotify player not initialized and no establecimientoId provided');
        }
      }

      // Esperar a que el dispositivo esté listo
      if (!this.deviceId) {
        console.log('Device ID not available, waiting for device ready event...');
        
        // Esperar el evento de dispositivo listo
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('spotifyDeviceReady', handleDeviceReady);
            reject(new Error('Timeout waiting for Spotify device to be ready'));
          }, 10000); // 10 segundos timeout
          
          const handleDeviceReady = (event: any) => {
            clearTimeout(timeout);
            window.removeEventListener('spotifyDeviceReady', handleDeviceReady);
            console.log('Device ready event received, deviceId:', event.detail.deviceId);
            this.deviceId = event.detail.deviceId;
            resolve();
          };
          
          window.addEventListener('spotifyDeviceReady', handleDeviceReady);
        });
      }

      // Obtener el token de acceso actual
      const credentials = await this.getCredentials(establecimientoId!);
      if (!credentials) {
        throw new Error('No valid Spotify credentials available');
      }

      // Verificar dispositivos activos
      const activeDevices = await this.checkActiveDevices(establecimientoId!);
      console.log('Active devices found:', activeDevices.length);
      
      if (activeDevices.length === 0) {
        throw new Error('No active Spotify devices found. Please open Spotify app and try again.');
      }

      const trackUri = `spotify:track:${track.spotify_id}`;
      console.log('Playing track URI:', trackUri, 'on device:', this.deviceId);

      // Usar el reproductor de Spotify Web Playback SDK directamente
      console.log('Using Spotify Web Playback SDK for playback...');
      
      // Activar el dispositivo primero
      await this.player.activateElement();
      
      // Usar el método del reproductor para reproducir
      const success = await this.player.getCurrentState().then((state: any) => {
        if (state) {
          console.log('Current player state:', state);
          return this.player.setVolume(0.5);
        }
        return false;
      });

      if (!success) {
        console.warn('Could not get current state, trying direct playback...');
      }

      // Intentar reproducir usando el reproductor
      try {
        await this.player.resume();
        console.log('Player resumed successfully');
      } catch (resumeError) {
        console.log('Resume failed, trying to start playback...');
      }

      // Usar la API de Spotify para reproducir la canción
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          uris: [trackUri],
          position_ms: 0
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Spotify API error:', errorData);
        
        if (response.status === 404 && errorData.error?.message === 'Device not found') {
          throw new Error('Spotify device not found. Please refresh the page and try again.');
        }
        
        if (response.status === 403) {
          throw new Error('Spotify playback requires user interaction. Please click the play button in Spotify app first, then try again.');
        }
        
        throw new Error(`Spotify API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      console.log('Track playback started successfully - FULL SONG');

      // Forzar reproducción usando el reproductor
      try {
        await this.player.resume();
        console.log('Forced resume after track start');
      } catch (error) {
        console.log('Could not force resume, but track should be playing');
      }

      // Actualizar inmediatamente el estado con la información de la canción
      const immediateState = {
        isPlaying: true,
        progress: 0,
        device: { id: this.deviceId },
        track: track
      };
      console.log('Emitting immediate playback state:', immediateState);
      this.playbackStateSubject.next(immediateState);
      
      // Forzar actualización del estado de conexión
      this.isConnectedSubject.next(true);
      
      // Emitir evento personalizado para el layout
      const customEvent = new CustomEvent('spotifyTrackPlayed', { 
        detail: { track: track, isPlaying: true } 
      });
      window.dispatchEvent(customEvent);
      console.log('Custom event dispatched for track:', track.titulo);

    } catch (error) {
      console.error('Error playing track:', error);
      throw error;
    }
  }

  // Pausar reproducción
  async pausePlayback(): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player not initialized');
    }

    try {
      await this.player.pause();
      console.log('Playback paused');
    } catch (error) {
      console.error('Error pausing playback:', error);
      throw error;
    }
  }

  // Reanudar reproducción
  async resumePlayback(): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player not initialized');
    }

    try {
      await this.player.resume();
      console.log('Playback resumed');
    } catch (error) {
      console.error('Error resuming playback:', error);
      throw error;
    }
  }

  // Siguiente canción
  async skipToNext(): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player not initialized');
    }

    try {
      await this.player.nextTrack();
      console.log('Skipped to next track');
    } catch (error) {
      console.error('Error skipping to next:', error);
      throw error;
    }
  }

  // Canción anterior
  async skipToPrevious(): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player not initialized');
    }

    try {
      await this.player.previousTrack();
      console.log('Skipped to previous track');
    } catch (error) {
      console.error('Error skipping to previous:', error);
      throw error;
    }
  }

  // Controlar volumen
  async setVolume(volume: number): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player not initialized');
    }

    try {
      await this.player.setVolume(volume / 100);
      console.log('Volume set to:', volume);
    } catch (error) {
      console.error('Error setting volume:', error);
      throw error;
    }
  }

  // Obtener historial de reproducción
  getHistory(establecimientoId: number, limit: number = 20): Observable<HistoryResponse> {
    return this.http.get<HistoryResponse>(`${environment.apiUrl}/musica/history/${establecimientoId}`, {
      params: { limit: limit.toString() }
    });
  }

  // Marcar canción como reproducida
  markAsPlayed(queueId: number, establecimientoId: number, userId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/musica/play-next`, {
      queueId,
      establecimientoId,
      userId
    });
  }

  // Verificar límites del usuario
  validateUserLimits(userId: number, establecimientoId: number): Observable<ValidationResponse> {
    return this.http.get<ValidationResponse>(`${environment.apiUrl}/musica/validate/${userId}/${establecimientoId}`);
  }

  // Método alternativo para reproducir usando múltiples estrategias
  async playTrackAlternative(track: SpotifyTrack, establecimientoId?: number): Promise<void> {
    try {
      console.log('Using alternative playback method for:', track.titulo);
      
      // Verificar si el reproductor está inicializado
      if (!this.player) {
        console.log('Player not initialized, attempting to initialize...');
        if (establecimientoId) {
          await this.initializePlayer(establecimientoId);
        } else {
          throw new Error('No establecimientoId provided');
        }
      }

      // Esperar a que el dispositivo esté listo
      if (!this.deviceId) {
        console.log('Waiting for device ready...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for device'));
          }, 10000);
          
          const handleDeviceReady = (event: any) => {
            clearTimeout(timeout);
            window.removeEventListener('spotifyDeviceReady', handleDeviceReady);
            this.deviceId = event.detail.deviceId;
            resolve();
          };
          
          window.addEventListener('spotifyDeviceReady', handleDeviceReady);
        });
      }

      const credentials = await this.getCredentials(establecimientoId!);
      if (!credentials) {
        throw new Error('No valid Spotify credentials available');
      }

      const trackUri = `spotify:track:${track.spotify_id}`;
      console.log('Alternative playback - Track URI:', trackUri);

      // Estrategia 1: Usar el reproductor directamente
      try {
        console.log('Strategy 1: Using player.togglePlay()');
        await this.player.togglePlay();
        console.log('Player toggle successful');
      } catch (error) {
        console.log('Strategy 1 failed:', error);
      }

      // Estrategia 2: Usar la API de Spotify con contexto
      try {
        console.log('Strategy 2: Using Spotify API with context');
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
          method: 'PUT',
          body: JSON.stringify({
            context_uri: `spotify:track:${track.spotify_id}`,
            offset: { position: 0 },
            position_ms: 0
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        });

        if (response.ok) {
          console.log('Strategy 2 successful');
        } else {
          console.log('Strategy 2 failed:', response.status);
        }
      } catch (error) {
        console.log('Strategy 2 error:', error);
      }

      // Estrategia 3: Usar uris array
      try {
        console.log('Strategy 3: Using uris array');
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
          method: 'PUT',
          body: JSON.stringify({
            uris: [trackUri],
            position_ms: 0
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        });

        if (response.ok) {
          console.log('Strategy 3 successful');
        } else {
          console.log('Strategy 3 failed:', response.status);
        }
      } catch (error) {
        console.log('Strategy 3 error:', error);
      }

      // Actualizar estado
      const immediateState = {
        isPlaying: true,
        progress: 0,
        device: { id: this.deviceId },
        track: track
      };
      this.playbackStateSubject.next(immediateState);
      this.isConnectedSubject.next(true);
      
      const customEvent = new CustomEvent('spotifyTrackPlayed', { 
        detail: { track: track, isPlaying: true } 
      });
      window.dispatchEvent(customEvent);
      console.log('Alternative playback completed for:', track.titulo);

    } catch (error) {
      console.error('Error in alternative playback:', error);
      throw error;
    }
  }

}