import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration: number;
  preview_url?: string;
  external_urls: any;
  images: any[];
}

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
  
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadSpotifySDK();
  }

  // Cargar Spotify Web Playback SDK
  private loadSpotifySDK(): void {
    if (typeof window !== 'undefined' && !window.Spotify) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.head.appendChild(script);

      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('Spotify Web Playback SDK ready');
      };
    }
  }

  // Iniciar flujo OAuth de Spotify
  async connectSpotify(): Promise<void> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const response = await this.http.get<any>(`${this.API_URL}/auth?userId=${currentUser.id}`).toPromise();
      
      if (response.success) {
        // Redirigir a Spotify para autorización
        window.location.href = response.authUrl;
      } else {
        throw new Error('Error al obtener URL de autorización');
      }
    } catch (error) {
      console.error('Error connecting to Spotify:', error);
      throw error;
    }
  }

  // Manejar callback de OAuth
  async handleCallback(code: string, state: string): Promise<void> {
    try {
      const response = await this.http.post<any>(`${this.API_URL}/callback`, {
        code,
        state
      }).toPromise();

      if (response.success) {
        this.isConnectedSubject.next(true);
        await this.initializePlayer();
      } else {
        throw new Error('Error al procesar callback de Spotify');
      }
    } catch (error) {
      console.error('Error handling Spotify callback:', error);
      throw error;
    }
  }

  // Inicializar el reproductor de Spotify
  async initializePlayer(): Promise<void> {
    try {
      const credentials = await this.getCredentials();
      if (!credentials) {
        throw new Error('No hay credenciales de Spotify disponibles');
      }

      if (!window.Spotify) {
        throw new Error('Spotify Web Playback SDK no está cargado');
      }

      this.player = new window.Spotify.Player({
        name: 'Playing Bar System',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(credentials.accessToken);
        },
        volume: 0.5
      });

      // Event listeners
      this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Ready with Device ID', device_id);
        this.deviceId = device_id;
      });

      this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device ID has gone offline', device_id);
      });

      this.player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Failed to initialize', message);
      });

      this.player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Failed to authenticate', message);
        this.isConnectedSubject.next(false);
      });

      this.player.addListener('account_error', ({ message }: { message: string }) => {
        console.error('Failed to validate Spotify account', message);
        this.isConnectedSubject.next(false);
      });

      this.player.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('Playback error', message);
      });

      this.player.addListener('player_state_changed', (state: any) => {
        if (state) {
          this.playbackStateSubject.next({
            isPlaying: state.paused,
            progress: state.position,
            device: state.device,
            track: state.track_window?.current_track ? {
              id: state.track_window.current_track.id,
              name: state.track_window.current_track.name,
              artists: state.track_window.current_track.artists.map((artist: any) => artist.name),
              album: state.track_window.current_track.album.name,
              duration: state.track_window.current_track.duration_ms,
              preview_url: state.track_window.current_track.preview_url,
              external_urls: state.track_window.current_track.external_urls,
              images: state.track_window.current_track.album.images
            } : null
          });
        }
      });

      // Conectar el reproductor
      const success = await this.player.connect();
      if (success) {
        console.log('Spotify player connected successfully');
        this.isConnectedSubject.next(true);
      } else {
        throw new Error('No se pudo conectar el reproductor de Spotify');
      }

    } catch (error) {
      console.error('Error initializing Spotify player:', error);
      throw error;
    }
  }

  // Obtener credenciales del usuario
  async getCredentials(): Promise<SpotifyCredentials | null> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        return null;
      }

      const response = await this.http.get<any>(`${this.API_URL}/credentials/${currentUser.id}`).toPromise();
      
      if (response.success) {
        return response.credentials;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting Spotify credentials:', error);
      return null;
    }
  }

  // Buscar canciones
  async searchTracks(query: string, limit: number = 20, offset: number = 0): Promise<SpotifyTrack[]> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const response = await this.http.get<any>(`${this.API_URL}/search/${currentUser.id}`, {
        params: { q: query, limit: limit.toString(), offset: offset.toString() }
      }).toPromise();

      if (response.success) {
        return response.tracks;
      } else {
        throw new Error('Error al buscar canciones');
      }
    } catch (error) {
      console.error('Error searching tracks:', error);
      throw error;
    }
  }

  // Reproducir canción
  async playTrack(trackUri: string): Promise<void> {
    try {
      if (!this.player || !this.deviceId) {
        throw new Error('Reproductor no inicializado');
      }

      const response = await this.http.put(`https://api.spotify.com/v1/me/player/play`, {
        uris: [trackUri]
      }, {
        headers: {
          'Authorization': `Bearer ${(await this.getCredentials())?.accessToken}`,
          'Content-Type': 'application/json'
        }
      }).toPromise();

      console.log('Playing track:', trackUri);
    } catch (error) {
      console.error('Error playing track:', error);
      throw error;
    }
  }

  // Pausar reproducción
  async pause(): Promise<void> {
    try {
      if (!this.player) {
        throw new Error('Reproductor no inicializado');
      }

      await this.player.pause();
    } catch (error) {
      console.error('Error pausing playback:', error);
      throw error;
    }
  }

  // Reanudar reproducción
  async resume(): Promise<void> {
    try {
      if (!this.player) {
        throw new Error('Reproductor no inicializado');
      }

      await this.player.resume();
    } catch (error) {
      console.error('Error resuming playback:', error);
      throw error;
    }
  }

  // Saltar a la siguiente canción
  async skipNext(): Promise<void> {
    try {
      if (!this.player) {
        throw new Error('Reproductor no inicializado');
      }

      await this.player.nextTrack();
    } catch (error) {
      console.error('Error skipping to next track:', error);
      throw error;
    }
  }

  // Volver a la canción anterior
  async skipPrevious(): Promise<void> {
    try {
      if (!this.player) {
        throw new Error('Reproductor no inicializado');
      }

      await this.player.previousTrack();
    } catch (error) {
      console.error('Error skipping to previous track:', error);
      throw error;
    }
  }

  // Cambiar volumen
  async setVolume(volume: number): Promise<void> {
    try {
      if (!this.player) {
        throw new Error('Reproductor no inicializado');
      }

      await this.player.setVolume(volume);
    } catch (error) {
      console.error('Error setting volume:', error);
      throw error;
    }
  }

  // Obtener estado de reproducción actual
  async getCurrentPlayback(): Promise<SpotifyPlaybackState | null> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        return null;
      }

      const response = await this.http.get<any>(`${this.API_URL}/playback/${currentUser.id}`).toPromise();
      
      if (response.success) {
        return response.playback;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting current playback:', error);
      return null;
    }
  }

  // Desconectar Spotify
  async disconnect(): Promise<void> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        return;
      }

      if (this.player) {
        await this.player.disconnect();
        this.player = null;
        this.deviceId = null;
      }

      await this.http.delete(`${this.API_URL}/disconnect/${currentUser.id}`).toPromise();
      
      this.isConnectedSubject.next(false);
      this.playbackStateSubject.next(null);
    } catch (error) {
      console.error('Error disconnecting Spotify:', error);
      throw error;
    }
  }

  // Verificar si está conectado
  isConnected(): boolean {
    return this.isConnectedSubject.value;
  }

  // Obtener usuario actual (helper)
  private getCurrentUser(): any {
    // Aquí deberías obtener el usuario actual de tu servicio de autenticación
    // Por ahora, asumimos que tienes un método para obtenerlo
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Refrescar token automáticamente
  private async refreshTokenIfNeeded(): Promise<string | null> {
    try {
      const credentials = await this.getCredentials();
      if (!credentials) {
        return null;
      }

      const expiresAt = new Date(credentials.expiresAt);
      const now = new Date();
      
      // Si el token expira en menos de 5 minutos, refrescarlo
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
          return null;
        }

        const response = await this.http.post<any>(`${this.API_URL}/refresh/${currentUser.id}`, {}).toPromise();
        
        if (response.success) {
          return response.accessToken;
        }
      }

      return credentials.accessToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }
}
