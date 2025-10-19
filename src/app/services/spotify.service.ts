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

// Declaración de tipos para Spotify Web Playback SDK
interface SpotifyPlayer {
  addListener: (event: string, callback: (data: any) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<any>;
  setName: (name: string) => Promise<void>;
  getVolume: () => Promise<number>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (position_ms: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
}

interface SpotifySDK {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume: number;
  }) => SpotifyPlayer;
}

// Usar (window as any) para evitar conflictos de tipos

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
  private isPlaying = false; // Flag para evitar múltiples reproducciones
  
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
        console.log('🎵 Spotify player ready with Device ID:', device_id);
        this.deviceId = device_id;
        this.isConnectedSubject.next(true);
        console.log('✅ Device registered successfully and connection status updated');
        
        // Emitir evento personalizado cuando el dispositivo esté listo
        const deviceReadyEvent = new CustomEvent('spotifyDeviceReady', { 
          detail: { deviceId: device_id } 
        });
        window.dispatchEvent(deviceReadyEvent);
        console.log('🎵 Device ready event dispatched');
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

  // Esperar a que el dispositivo esté listo
  async waitForDevice(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.deviceId) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 segundos máximo
      
      const checkDevice = () => {
        if (this.deviceId) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Device not ready after 5 seconds'));
        } else {
          attempts++;
          setTimeout(checkDevice, 100);
        }
      };
      checkDevice();
    });
  }

  // Cargar canción en el reproductor sin reproducir
  async loadTrack(track: SpotifyTrack, establecimientoId: number): Promise<void> {
    try {
      if (!this.player || !this.deviceId) {
        console.error('Player not ready');
        return;
      }

      const credentials = await this.getCredentials(establecimientoId);
      if (!credentials) {
        console.error('No credentials available');
        return;
      }

      // Transferir al dispositivo web
      await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [this.deviceId]
        })
      });

      // Cargar la canción (sin reproducir)
      await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [`spotify:track:${track.spotify_id}`],
          device_id: this.deviceId,
          position_ms: 0
        })
      });

      // Pausar inmediatamente
      await this.pausePlayback();
      
      console.log('✅ Track loaded and paused');
    } catch (error) {
      console.error('Error loading track:', error);
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

  // Verificar si está conectado - SOLO BÚSQUEDA
  isConnected(): boolean {
    return true; // Siempre conectado para búsqueda
  }

  // Auto-inicializar reproductor - DESHABILITADO
  async autoInitializePlayer(): Promise<boolean> {
    console.log('⚠️ Player initialization disabled - search only mode');
    return true;
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

  // Agregar canción a la cola con reproducción inmediata (posición 1)
  async addToQueueAndPlay(track: SpotifyTrack, userId: number, establecimientoId: number): Promise<void> {
    try {
      // Agregar a la cola
      const response = await this.http.post(`${environment.apiUrl}/musica/queue`, {
        track,
        userId,
        establecimientoId,
        playImmediately: true
      }).toPromise();
      
      if (response && (response as any).success) {
        console.log('✅ Track added to queue');
        
        // Actualizar UI directamente - esto funcionaba
        const state = {
          isPlaying: true,
          progress: 0,
          device: { id: 'web-player' },
          track: track
        };
        this.playbackStateSubject.next(state);
        
        // Emitir evento para mostrar la canción en el header
        const customEvent = new CustomEvent('spotifyTrackPlayed', { 
          detail: { track: track, isPlaying: true } 
        });
        window.dispatchEvent(customEvent);
        
        console.log('✅ Track UI updated successfully');
      } else {
        throw new Error('Failed to add track to queue');
      }
    } catch (error) {
      console.error('Error adding track to queue:', error);
      throw error;
    }
  }

  // Método alternativo de reproducción
  async playTrackAlternative(track: SpotifyTrack, establecimientoId: number): Promise<void> {
    try {
      console.log('🔄 Trying alternative playback method...');
      
      const credentials = await this.getCredentials(establecimientoId);
      if (!credentials) {
        throw new Error('No credentials available');
      }

      // Usar el mismo método principal
      await this.playTrack(track, establecimientoId);
      
    } catch (error) {
      console.error('Alternative playback error:', error);
      throw error;
    }
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


  // Reproducir canción - CON REPRODUCCIÓN REAL
  async playTrack(track: SpotifyTrack, establecimientoId?: number): Promise<void> {
    try {
      console.log('🎵 Playing track:', track.titulo, 'by', track.artista);
      
      if (!establecimientoId) {
        console.error('No establecimiento ID provided');
        return;
      }

      // Obtener credenciales válidas
      const credentials = await this.getCredentials(establecimientoId);
      if (!credentials) {
        console.error('No valid credentials available');
        return;
      }

      // Inicializar el reproductor web si no existe
      if (!this.player) {
        console.log('🔄 Initializing web player...');
        await this.initializeWebPlayer(establecimientoId);
      }

      // Esperar a que el dispositivo esté listo
      if (!this.deviceId) {
        console.log('⏳ Waiting for web device...');
        await this.waitForDevice();
      }

      // Reproducir usando el dispositivo web
      await this.playOnWebDevice(track, credentials);
      
    } catch (error) {
      console.error('Error playing track:', error);
      // Si falla, al menos actualizar la UI
      const state = {
        isPlaying: true,
        progress: 0,
        device: { id: 'web-player' },
        track: track
      };
      this.playbackStateSubject.next(state);
      
      const customEvent = new CustomEvent('spotifyTrackPlayed', { 
        detail: { track: track, isPlaying: true } 
      });
      window.dispatchEvent(customEvent);
    }
  }

  // Inicializar reproductor web
  async initializeWebPlayer(establecimientoId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Cargar el SDK de Spotify si no está cargado
      if (!(window as any).Spotify) {
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.head.appendChild(script);
        
        script.onload = () => {
          this.setupWebPlayer(establecimientoId, resolve, reject);
        };
        script.onerror = () => {
          reject(new Error('Failed to load Spotify SDK'));
        };
      } else {
        this.setupWebPlayer(establecimientoId, resolve, reject);
      }
    });
  }

  // Configurar el reproductor web
  async setupWebPlayer(establecimientoId: number, resolve: Function, reject: Function): Promise<void> {
    try {
      const credentials = await this.getCredentials(establecimientoId);
      if (!credentials) {
        reject(new Error('No credentials available'));
        return;
      }

      this.player = new (window as any).Spotify.Player({
        name: 'Playing Music App',
        getOAuthToken: (cb: Function) => {
          cb(credentials.accessToken);
        },
        volume: 0.5
      });

      // Eventos del reproductor
      this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('✅ Web player ready with device ID:', device_id);
        this.deviceId = device_id;
        resolve();
      });

      this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('⚠️ Web player not ready:', device_id);
      });

      this.player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('❌ Web player initialization error:', message);
        reject(new Error(message));
      });

      this.player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('❌ Web player authentication error:', message);
        reject(new Error(message));
      });

      this.player.addListener('account_error', ({ message }: { message: string }) => {
        console.error('❌ Web player account error:', message);
        reject(new Error(message));
      });

      this.player.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('❌ Web player playback error:', message);
      });

             // Estado de reproducción
             this.player.addListener('player_state_changed', (state: any) => {
               if (state) {
                 const trackInfo = state.track_window?.current_track;
                 if (trackInfo) {
                   const playbackState = {
                     isPlaying: !state.paused,
                     progress: state.position,
                     device: { id: this.deviceId || 'web-player' },
                     track: {
                       spotify_id: trackInfo.id,
                       titulo: trackInfo.name,
                       artista: trackInfo.artists[0]?.name,
                       album: trackInfo.album?.name || '',
                       duracion: trackInfo.duration_ms,
                       imagen_url: trackInfo.album?.images[0]?.url
                     } as SpotifyTrack
                   };
                   console.log('Emitting playback state:', playbackState);
                   this.playbackStateSubject.next(playbackState);
                 }
               }
             });

      // Conectar el reproductor
      this.player.connect();
    } catch (error) {
      reject(error);
    }
  }


  // Reproducir en el dispositivo web - VERSIÓN QUE FUNCIONA
  async playOnWebDevice(track: SpotifyTrack, credentials: any): Promise<void> {
    try {
      console.log('🎵 Playing on web device:', this.deviceId);
      
      // Primero transferir al dispositivo web
      const transferResponse = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [this.deviceId]
        })
      });

      if (!transferResponse.ok) {
        console.log('⚠️ Transfer failed, trying direct play...');
      }

      // Esperar un momento para que el dispositivo se active
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reproducir la canción
      const playResponse = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [`spotify:track:${track.spotify_id}`],
          device_id: this.deviceId
        })
      });

      if (playResponse.ok) {
        console.log('✅ Track started playing on web device');
        
        // Actualizar el estado de reproducción
    const state = {
          isPlaying: true,
      progress: 0,
          device: { id: this.deviceId },
      track: track
    };
    this.playbackStateSubject.next(state);
    
    // Emitir evento para mostrar la canción en el header
    const customEvent = new CustomEvent('spotifyTrackPlayed', { 
          detail: { track: track, isPlaying: true } 
    });
    window.dispatchEvent(customEvent);
      } else {
        const errorData = await playResponse.json();
        console.error('❌ Web device playback failed:', errorData);
        throw new Error(`Web device playback failed: ${errorData.error?.message}`);
      }
    } catch (error) {
      console.error('Web device playback error:', error);
      throw error;
    }
  }


  // Pausar reproducción
  async pausePlayback(): Promise<void> {
    try {
      if (!this.player) {
        console.error('No player available');
        return;
      }
      
      await this.player.pause();
      console.log('⏸️ Playback paused');
    } catch (error) {
      console.error('Error pausing playback:', error);
    }
  }

  // Reanudar reproducción
  async resumePlayback(): Promise<void> {
    try {
      if (!this.player) {
        console.error('No player available');
        return;
      }
      
      await this.player.resume();
      console.log('▶️ Playback resumed');
    } catch (error) {
      console.error('Error resuming playback:', error);
    }
  }

  // Siguiente canción
  async skipToNext(): Promise<void> {
    try {
      if (!this.player) {
        console.error('No player available');
        return;
      }
      
      await this.player.nextTrack();
      console.log('⏭️ Skipped to next track');
    } catch (error) {
      console.error('Error skipping to next track:', error);
    }
  }

  // Canción anterior
  async skipToPrevious(): Promise<void> {
    try {
      if (!this.player) {
        console.error('No player available');
        return;
      }
      
      await this.player.previousTrack();
      console.log('⏮️ Skipped to previous track');
    } catch (error) {
      console.error('Error skipping to previous track:', error);
    }
  }

  // Controlar volumen
  async setVolume(volume: number): Promise<void> {
    try {
      if (!this.player) {
        console.error('No player available');
        return;
      }
      
      await this.player.setVolume(volume / 100);
      // console.log(`🔊 Volume set to ${volume}%`);
    } catch (error) {
      console.error('Error setting volume:', error);
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


}