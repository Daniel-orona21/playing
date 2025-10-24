import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  SpotifySearchResponse, 
  SpotifyGenresResponse,
  SpotifyTrack, 
} from '../models/musica.interfaces';

// Declaración de tipos para Spotify Web Playback SDK
interface SpotifyPlayer {
  addListener: (event: string, callback: (data: any) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getVolume: () => Promise<number>;
  setVolume: (volume: number) => Promise<void>;
}

interface SpotifySDK {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume: number;
  }) => SpotifyPlayer;
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
  
  // Estados
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();


  constructor(private http: HttpClient) {}


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
      await this.http.delete(`${environment.apiUrl}/spotify-establecimiento/disconnect/${establecimientoId}`).toPromise();
      this.isConnectedSubject.next(false);
    } catch (error: any) {
      console.error('Error disconnecting Spotify:', error);
      throw error;
    }
  }

  // Verificar si está conectado - SOLO BÚSQUEDA
  isConnected(): boolean {
    return true; // Siempre conectado para búsqueda
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

  // Buscar canciones por artista
  getTracksByArtist(artistId: string, establecimientoId: number): Observable<SpotifySearchResponse> {
    return this.http.get<SpotifySearchResponse>(`${environment.apiUrl}/musica/artists/${artistId}/tracks`, {
      params: { establecimientoId: establecimientoId.toString() }
    });
  }

  // ========== GESTIÓN DE COLA ==========

  // Agregar canción a la cola
  addToQueue(track: SpotifyTrack, establecimientoId: number, usuarioId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/musica/queue`, {
      spotify_id: track.spotify_id,
      titulo: track.titulo,
      artista: track.artista,
      album: track.album,
      duracion: track.duracion,
      imagen_url: track.imagen_url,
      genero: track.genero,
      preview_url: track.preview_url,
      establecimientoId,
      usuarioId
    });
  }

  // ✅ NUEVO: Agregar canción y reproducir inmediatamente (al principio de la cola)
  addToQueueAndPlayNow(track: SpotifyTrack, establecimientoId: number, usuarioId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/musica/queue/play-now`, {
      spotify_id: track.spotify_id,
      titulo: track.titulo,
      artista: track.artista,
      album: track.album,
      duracion: track.duracion,
      imagen_url: track.imagen_url,
      genero: track.genero,
      preview_url: track.preview_url,
      establecimientoId,
      usuarioId
    });
  }

  // Obtener la cola de canciones
  getQueue(establecimientoId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/musica/queue`, {
      params: { establecimientoId: establecimientoId.toString() }
    });
  }

  // Eliminar canción de la cola
  removeFromQueue(colaId: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/musica/queue/${colaId}`);
  }

  // Actualizar estado de canción en la cola
  updateQueueStatus(colaId: number, status: string): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/musica/queue/${colaId}/status`, {
      status
    });
  }

  // Establecer canción actual como playing (mueve las anteriores al historial)
  setCurrentPlaying(colaId: number, establecimientoId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/musica/queue/set-playing`, {
      colaId,
      establecimientoId
    });
  }

  // Mover canción al historial
  moveToHistory(colaId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/musica/queue/${colaId}/move-to-history`, {});
  }

  // Obtener historial de reproducción
  getHistory(establecimientoId: number, limit: number = 50): Observable<any> {
    return this.http.get(`${environment.apiUrl}/musica/history`, {
      params: { 
        establecimientoId: establecimientoId.toString(),
        limit: limit.toString()
      }
    });
  }

  // Obtener la canción actualmente en reproducción
  getCurrentPlaying(establecimientoId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/musica/queue/current-playing`, {
      params: { establecimientoId: establecimientoId.toString() }
    });
  }

  // Reordenar cola - cambiar posición de una canción
  reorderQueue(cancionId: number, nuevaPosicion: number, establecimientoId: number): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/musica/queue/reorder`, {
      cancionId,
      nuevaPosicion,
      establecimientoId
    });
  }
}