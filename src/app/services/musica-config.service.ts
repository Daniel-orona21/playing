import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  ConfigResponse, 
  FiltersResponse, 
  ValidationResponse,
  ConfiguracionMusica,
  FiltroContenido 
} from '../models/musica.interfaces';

@Injectable({
  providedIn: 'root'
})
export class MusicaConfigService {
  private readonly API_URL = `${environment.apiUrl}/musica`;

  constructor(private http: HttpClient) {}

  // Obtener configuración del establecimiento
  getConfig(establecimientoId: number): Observable<ConfigResponse> {
    return this.http.get<ConfigResponse>(`${this.API_URL}/config/${establecimientoId}`);
  }

  // Actualizar configuración
  updateConfig(establecimientoId: number, config: ConfiguracionMusica): Observable<any> {
    return this.http.put(`${this.API_URL}/config/${establecimientoId}`, config);
  }

  // Obtener filtros del establecimiento
  getFilters(establecimientoId: number): Observable<FiltersResponse> {
    return this.http.get<FiltersResponse>(`${this.API_URL}/filters/${establecimientoId}`);
  }

  // Agregar filtro
  addFilter(filter: Partial<FiltroContenido>): Observable<any> {
    return this.http.post(`${this.API_URL}/filters`, filter);
  }

  // Eliminar filtro
  removeFilter(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/filters/${id}`);
  }

  // Verificar límites del usuario
  validateUserLimits(userId: number, establecimientoId: number): Observable<ValidationResponse> {
    return this.http.get<ValidationResponse>(`${this.API_URL}/validate/${userId}/${establecimientoId}`);
  }

  // Crear filtro para canción
  createSongFilter(establecimientoId: number, spotifyId: string, razon?: string): Partial<FiltroContenido> {
    return {
      establecimiento_id: establecimientoId,
      tipo: 'cancion',
      spotify_id: spotifyId,
      razon: razon || 'Bloqueada por el administrador'
    };
  }

  // Crear filtro para género
  createGenreFilter(establecimientoId: number, genero: string, razon?: string): Partial<FiltroContenido> {
    return {
      establecimiento_id: establecimientoId,
      tipo: 'genero',
      genero: genero,
      razon: razon || 'Género bloqueado por el administrador'
    };
  }
}
