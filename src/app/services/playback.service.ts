import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SpotifyTrack } from '../models/musica.interfaces';
import { MusicaSocketService } from './musica-socket.service';

// Declaración de tipos para Spotify Web Playback SDK
// Usamos any para evitar conflictos con los tipos del SDK de Spotify

export interface PlaybackState {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  isPaused: boolean;
  position: number;
  duration: number;
  volume: number;
}

export interface SpotifyCredentialsResponse {
  id?: number;
  establecimiento_id?: number;
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresAt?: string;
  expires_at?: string;
  scope: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlaybackService {
  private player: any = null;
  private deviceId: string | null = null;
  private accessToken: string | null = null;
  private establecimientoId: number | null = null;
  
  // Estados del reproductor
  private playbackStateSubject = new BehaviorSubject<PlaybackState>({
    currentTrack: null,
    isPlaying: false,
    isPaused: true,
    position: 0,
    duration: 0,
    volume: 0.75
  });
  
  public playbackState$ = this.playbackStateSubject.asObservable();
  
  private isInitializedSubject = new BehaviorSubject<boolean>(false);
  public isInitialized$ = this.isInitializedSubject.asObservable();
  
  private isReadySubject = new BehaviorSubject<boolean>(false);
  public isReady$ = this.isReadySubject.asObservable();

  private progressInterval: any = null;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private musicaSocketService: MusicaSocketService
  ) {}

  /**
   * Emitir actualización de estado de reproducción al backend
   */
  private notifyPlaybackStateChange(isPlaying: boolean, position: number = 0): void {
    if (!this.establecimientoId) return;
    
    this.http.post(`${environment.apiUrl}/musica/playback/state`, {
      establecimientoId: this.establecimientoId,
      isPlaying,
      position
    }).subscribe({
      next: () => console.log('📡 Estado de reproducción notificado al backend'),
      error: (err) => console.error('Error notificando estado:', err)
    });
  }

  /**
   * Emitir actualización completa de estado al backend
   */
  private notifyFullPlaybackUpdate(state: any, track: SpotifyTrack): void {
    if (!this.establecimientoId) return;
    
    // Emitir a través del backend que distribuye vía Socket.IO
    this.http.post(`${environment.apiUrl}/musica/playback/state`, {
      establecimientoId: this.establecimientoId,
      isPlaying: !state.paused,
      position: state.position,
      duration: state.duration,
      currentTrack: {
        spotify_id: track.spotify_id,
        titulo: track.titulo,
        artista: track.artista,
        album: track.album,
        duracion: Math.floor(state.duration / 1000),
        imagen_url: track.imagen_url
      }
    }).subscribe({
      error: (err) => console.error('Error notificando estado:', err)
    });
  }

  /**
   * Iniciar emisión periódica de progreso (cada 1 segundo)
   * Esto es necesario porque player_state_changed NO se emite continuamente
   */
  private startProgressEmission(): void {
    // Limpiar intervalo anterior si existe
    this.stopProgressEmission();
    
    // Emitir progreso cada 1 segundo
    this.progressInterval = setInterval(() => {
      if (this.player) {
        this.player.getCurrentState().then((state: any) => {
          if (state && !state.paused) {
            const track = state.track_window.current_track;
            const currentTrack: SpotifyTrack = {
              spotify_id: track.id || track.uri.split(':')[2],
              titulo: track.name,
              artista: track.artists.map((a: any) => a.name).join(', '),
              album: track.album.name,
              duracion: Math.floor(track.duration_ms / 1000),
              imagen_url: track.album.images[0]?.url || '',
            };
            
            // Emitir el estado actual
            this.notifyFullPlaybackUpdate(state, currentTrack);
          }
        });
      }
    }, 1000); // Cada 1 segundo
  }

  /**
   * Detener emisión periódica de progreso
   */
  private stopProgressEmission(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Inicializa el reproductor de Spotify con las credenciales del establecimiento
   */
  async initialize(establecimientoId: number): Promise<void> {
    console.log('🎵 PlaybackService.initialize() called with establecimientoId:', establecimientoId);
    
    if (this.isInitializedSubject.value) {
      console.log('✅ Playback already initialized');
      return;
    }

    try {
      this.establecimientoId = establecimientoId;
      console.log('🔄 Step 1: Initializing Spotify Playback for establishment:', establecimientoId);

      // Obtener credenciales del establecimiento
      console.log('🔄 Step 2: Getting credentials...');
      const credentials = await this.getEstablishmentCredentials(establecimientoId);
      console.log('Credentials received:', credentials ? 'Yes' : 'No');
      console.log('Credentials object:', credentials);
      console.log('Credentials keys:', credentials ? Object.keys(credentials) : 'N/A');
      
      if (!credentials) {
        throw new Error('No se pudieron obtener las credenciales del establecimiento');
      }

      // Manejar ambos formatos: camelCase y snake_case
      this.accessToken = credentials.accessToken || credentials.access_token || '';
      console.log('Access token value:', this.accessToken);
      console.log('Access token type:', typeof this.accessToken);
      
      if (!this.accessToken) {
        throw new Error('Access token is missing in credentials');
      }
      
      console.log('✅ Step 2 complete: Access token obtained:', this.accessToken.substring(0, 20) + '...');

      // Esperar a que el SDK esté listo
      console.log('🔄 Step 3: Loading Spotify SDK...');
      await this.waitForSpotifySDK();
      console.log('✅ Step 3 complete: SDK loaded');
      
      // Crear el reproductor
      console.log('🔄 Step 4: Creating player...');
      await this.createPlayer();
      console.log('✅ Step 4 complete: Player created');
      
      this.isInitializedSubject.next(true);
      console.log('✅✅✅ Spotify Playback initialized successfully! ✅✅✅');
      console.log('Device ID:', this.deviceId);
      
      // Conectar al servicio de Socket para emitir eventos
      this.musicaSocketService.connect(establecimientoId);
    } catch (error) {
      console.error('❌❌❌ Error initializing Spotify Playback:', error);
      console.error('Error stack:', error);
      throw error;
    }
  }

  /**
   * Obtiene las credenciales del establecimiento desde el backend
   */
  private async getEstablishmentCredentials(establecimientoId: number): Promise<SpotifyCredentialsResponse | null> {
    try {
      const response = await this.http.get<any>(
        `${environment.apiUrl}/spotify-establecimiento/credentials/${establecimientoId}`
      ).toPromise();

      console.log('Credentials response:', response);
      console.log('Response type:', typeof response);
      console.log('Is array?', Array.isArray(response));

      // Manejar diferentes formatos de respuesta
      if (response) {
        // Formato nuevo: {success: true, credentials: {...}}
        if (response.success && response.credentials) {
          console.log('Using new format (success + credentials object)');
          return response.credentials;
        }
        
        // Formato array: [{...}]
        if (Array.isArray(response) && response.length > 0) {
          console.log('Using array format');
          return response[0];
        }
        
        // Formato directo: {...} (snake_case o camelCase)
        if (response.access_token || response.accessToken) {
          console.log('Using direct format');
          return response;
        }
      }

      console.error('No valid credentials format found in response');
      return null;
    } catch (error) {
      console.error('Error getting establishment credentials:', error);
      return null;
    }
  }

  /**
   * Carga el SDK de Spotify dinámicamente
   */
  private loadSpotifySDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as any;
      
      // Si ya está disponible, resolver inmediatamente
      if (w.Spotify) {
        console.log('Spotify SDK already loaded');
        resolve();
        return;
      }

      console.log('Loading Spotify SDK dynamically...');
      
      // Definir el callback ANTES de cargar el script
      w.onSpotifyWebPlaybackSDKReady = () => {
        console.log('Spotify Web Playback SDK is ready');
        resolve();
      };

      // Crear y agregar el script tag
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      
      script.onerror = () => {
        reject(new Error('Failed to load Spotify SDK'));
      };

      document.head.appendChild(script);
      
      // Timeout de seguridad
      setTimeout(() => {
        if (!w.Spotify) {
          reject(new Error('Spotify SDK no se cargó a tiempo'));
        }
      }, 10000);
    });
  }

  /**
   * Espera a que el SDK de Spotify esté disponible
   */
  private async waitForSpotifySDK(): Promise<void> {
    await this.loadSpotifySDK();
  }

  /**
   * Crea el reproductor de Spotify
   */
  private async createPlayer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as any;
      
      console.log('Creating Spotify Player...');
      console.log('Access token available:', !!this.accessToken);
      
      try {
        this.player = new w.Spotify.Player({
          name: 'Playing Web Player',
          getOAuthToken: (cb: (token: string) => void) => {
            console.log('getOAuthToken callback called');
            cb(this.accessToken!);
          },
          volume: 0.75
        });

        console.log('Player instance created');

        // Error handling
        this.player.addListener('initialization_error', ({ message }: any) => {
          console.error('❌ Initialization Error:', message);
          reject(new Error(message));
        });

        this.player.addListener('authentication_error', ({ message }: any) => {
          console.error('❌ Authentication Error:', message);
          this.ngZone.run(() => {
            this.refreshToken();
          });
        });

        this.player.addListener('account_error', ({ message }: any) => {
          console.error('❌ Account Error:', message);
          console.error('This account needs to be Spotify Premium to use Web Playback');
          reject(new Error(message));
        });

        this.player.addListener('playback_error', ({ message }: any) => {
          console.error('❌ Playback Error:', message);
        });

        // Ready
        this.player.addListener('ready', ({ device_id }: any) => {
          console.log('✅ Player Ready with Device ID:', device_id);
          this.ngZone.run(() => {
            this.deviceId = device_id;
            this.isReadySubject.next(true);
            console.log('isReadySubject set to true');
          });
          resolve();
        });

        // Not Ready
        this.player.addListener('not_ready', ({ device_id }: any) => {
          console.log('⚠️ Device ID has gone offline:', device_id);
          this.ngZone.run(() => {
            this.isReadySubject.next(false);
          });
        });

        // Player state changed - Se dispara cuando cambia play/pause/canción
        // NO se dispara continuamente durante reproducción
        this.player.addListener('player_state_changed', (state: any) => {
          if (!state) {
            return;
          }

          this.ngZone.run(() => {
            this.updatePlaybackState(state);
            
            // Obtener track actual
            const track = state.track_window.current_track;
            const currentTrack: SpotifyTrack = {
              spotify_id: track.id || track.uri.split(':')[2],
              titulo: track.name,
              artista: track.artists.map((a: any) => a.name).join(', '),
              album: track.album.name,
              duracion: Math.floor(track.duration_ms / 1000),
              imagen_url: track.album.images[0]?.url || '',
            };
            
            // Emitir estado inicial
            this.notifyFullPlaybackUpdate(state, currentTrack);
            
            // Manejar emisión periódica según el estado
            if (!state.paused) {
              this.startProgressEmission();
            } else {
              this.stopProgressEmission();
            }
          });
        });

        console.log('Event listeners added, connecting player...');

        // Connect to the player
        this.player.connect().then((success: boolean) => {
          if (success) {
            console.log('✅ The Web Playback SDK successfully connected to Spotify!');
          } else {
            console.error('❌ The Web Playback SDK could not connect to Spotify');
            reject(new Error('Could not connect to Spotify'));
          }
        });
      } catch (error) {
        console.error('Error creating player:', error);
        reject(error);
      }
    });
  }

  /**
   * Actualiza el estado de reproducción
   */
  private updatePlaybackState(state: any): void {
    const track = state.track_window.current_track;
    
    const currentTrack: SpotifyTrack = {
      spotify_id: track.id || track.uri.split(':')[2],
      titulo: track.name,
      artista: track.artists.map((a: any) => a.name).join(', '),
      album: track.album.name,
      duracion: track.duration_ms,
      imagen_url: track.album.images[0]?.url || '',
    };

    const newState: PlaybackState = {
      currentTrack,
      isPlaying: !state.paused,
      isPaused: state.paused,
      position: state.position,
      duration: state.duration,
      volume: this.playbackStateSubject.value.volume
    };

    this.playbackStateSubject.next(newState);
  }

  /**
   * Reproduce una canción usando su Spotify URI
   */
  async playTrack(spotifyId: string, track: SpotifyTrack): Promise<void> {
    console.log('🎵 Playing:', track.titulo);

    // Esperar a que el reproductor esté listo
    if (!this.isReadySubject.value) {
      console.log('Waiting for player...');
      await this.waitForPlayerReady();
    }

    if (!this.deviceId || !this.accessToken) {
      throw new Error('Player not ready');
    }

    try {
      const spotifyUri = spotifyId.startsWith('spotify:') ? spotifyId : `spotify:track:${spotifyId}`;

      // Reproducir directamente en el dispositivo
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [spotifyUri] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        
        // Si el error es que el dispositivo no está activo, transferir y reintentar
        if (response.status === 404 || (errorData.error?.reason === 'NO_ACTIVE_DEVICE')) {
          console.log('Device not active, transferring playback...');
          
          await fetch(`https://api.spotify.com/v1/me/player`, {
            method: 'PUT',
            body: JSON.stringify({ 
              device_ids: [this.deviceId],
              play: true
            }),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.accessToken}`
            }
          });
          
          // Esperar un poco
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Reintentar reproducir
          const retryResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [spotifyUri] }),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.accessToken}`
            }
          });
          
          if (!retryResponse.ok) {
            throw new Error(`Error al reproducir después de activar dispositivo`);
          }
        } else {
          throw new Error(`Error al reproducir: ${errorData.error?.message || response.status}`);
        }
      }

      // Actualizar el estado
      const currentState = this.playbackStateSubject.value;
      this.playbackStateSubject.next({
        ...currentState,
        currentTrack: track,
        isPlaying: true,
        isPaused: false
      });

      // Iniciar emisión periódica de progreso
      this.startProgressEmission();
      
      console.log('✅ Playing');
    } catch (error) {
      console.error('❌ Error playing:', error);
      throw error;
    }
  }

  /**
   * Espera a que el reproductor esté listo
   */
  private waitForPlayerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Si ya está listo, resolver inmediatamente
      if (this.isReadySubject.value) {
        resolve();
        return;
      }

      // Suscribirse a cambios en isReady
      const subscription = this.isReady$.subscribe(isReady => {
        if (isReady) {
          subscription.unsubscribe();
          resolve();
        }
      });

      // Timeout de 30 segundos
      setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error('Timeout esperando a que el reproductor esté listo'));
      }, 30000);
    });
  }

  /**
   * Pausa la reproducción
   */
  async pause(): Promise<void> {
    if (!this.player) {
      return;
    }

    try {
      await this.player.pause();
      const currentState = this.playbackStateSubject.value;
      this.playbackStateSubject.next({
        ...currentState,
        isPlaying: false,
        isPaused: true
      });
      
      // Detener emisión periódica
      this.stopProgressEmission();
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }

  /**
   * Reanuda la reproducción
   */
  async resume(): Promise<void> {
    if (!this.player) {
      return;
    }

    try {
      await this.player.resume();
      const currentState = this.playbackStateSubject.value;
      this.playbackStateSubject.next({
        ...currentState,
        isPlaying: true,
        isPaused: false
      });
      
      // Iniciar emisión periódica
      this.startProgressEmission();
    } catch (error) {
      console.error('Error resuming:', error);
    }
  }

  /**
   * Alterna entre play y pause
   */
  async togglePlay(): Promise<void> {
    const currentState = this.playbackStateSubject.value;
    
    if (currentState.isPlaying) {
      await this.pause();
    } else {
      await this.resume();
    }
  }

  /**
   * Siguiente canción
   */
  async nextTrack(): Promise<void> {
    if (!this.player) {
      return;
    }

    try {
      await this.player.nextTrack();
    } catch (error) {
      console.error('Error going to next track:', error);
    }
  }

  /**
   * Canción anterior
   */
  async previousTrack(): Promise<void> {
    if (!this.player) {
      return;
    }

    try {
      await this.player.previousTrack();
    } catch (error) {
      console.error('Error going to previous track:', error);
    }
  }

  /**
   * Cambia el volumen
   */
  async setVolume(volume: number): Promise<void> {
    if (!this.player) {
      return;
    }

    try {
      // El volumen debe estar entre 0 y 1
      const normalizedVolume = Math.max(0, Math.min(1, volume));
      await this.player.setVolume(normalizedVolume);
      
      const currentState = this.playbackStateSubject.value;
      this.playbackStateSubject.next({
        ...currentState,
        volume: normalizedVolume
      });
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  /**
   * Cambia la posición de reproducción (seek)
   * @param positionMs Posición en milisegundos
   */
  async seek(positionMs: number): Promise<void> {
    if (!this.player) {
      return;
    }

    try {
      await this.player.seek(positionMs);
      
      // Actualizar el estado inmediatamente para feedback visual
      const currentState = this.playbackStateSubject.value;
      this.playbackStateSubject.next({
        ...currentState,
        position: positionMs
      });
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }

  /**
   * Obtiene el estado actual de reproducción
   */
  getCurrentState(): PlaybackState {
    return this.playbackStateSubject.value;
  }

  /**
   * Refresca el token de acceso
   */
  private async refreshToken(): Promise<void> {
    if (!this.establecimientoId) {
      return;
    }

    try {
      console.log('Refreshing access token...');
      const response = await this.http.post<any>(
        `${environment.apiUrl}/spotify-establecimiento/refresh/${this.establecimientoId}`,
        {}
      ).toPromise();

      if (response && response.success) {
        const credentials = await this.getEstablishmentCredentials(this.establecimientoId);
        if (credentials) {
          // Manejar ambos formatos: camelCase y snake_case
          this.accessToken = credentials.accessToken || credentials.access_token || '';
          console.log('Access token refreshed successfully');
        }
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  }

  /**
   * Desconecta el reproductor
   */
  disconnect(): void {
    if (this.player) {
      // Detener emisión de progreso
      this.stopProgressEmission();
      
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
      this.accessToken = null;
      this.isInitializedSubject.next(false);
      this.isReadySubject.next(false);
      this.playbackStateSubject.next({
        currentTrack: null,
        isPlaying: false,
        isPaused: true,
        position: 0,
        duration: 0,
        volume: 0.75
      });
      
      // Desconectar socket
      this.musicaSocketService.disconnect();
    }
  }
}

