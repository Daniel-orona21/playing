import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Filtro {
  id_filtro: number;
  establecimiento_id: number;
  tipo: 'genero' | 'artista' | 'cancion';
  valor: string;
  nombre_display: string;
  imagen_url?: string;
  creado_por: number;
  creado_por_nombre: string;
  creada_en: string;
}

export interface AddFiltroRequest {
  establecimientoId: number;
  tipo: 'genero' | 'artista' | 'cancion';
  valor: string;
  nombreDisplay?: string;
  imagenUrl?: string;
  usuarioId: number;
}

export interface CheckBlockedRequest {
  establecimientoId: number;
  spotifyId: string;
  artista: string;
  genero?: string;
}

export interface CheckBlockedResponse {
  success: boolean;
  isBlocked: boolean;
  reason?: {
    tipo: string;
    valor: string;
    nombre: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class FiltrosService {
  private readonly API_URL = `${environment.apiUrl}/filtros`;
  
  // Cache de filtros del establecimiento actual
  private filtrosSubject = new BehaviorSubject<Filtro[]>([]);
  public filtros$ = this.filtrosSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Obtener todos los filtros de un establecimiento
  getFiltros(establecimientoId: number): Observable<any> {
    return this.http.get(`${this.API_URL}?establecimientoId=${establecimientoId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap((response: any) => {
        if (response.success) {
          this.filtrosSubject.next(response.filtros);
        }
      })
    );
  }

  // Agregar un filtro (bloquear)
  addFiltro(filtro: AddFiltroRequest): Observable<any> {
    return this.http.post(this.API_URL, filtro, {
      headers: this.getHeaders()
    }).pipe(
      tap((response: any) => {
        if (response.success && filtro.establecimientoId) {
          // Recargar filtros para actualizar el cache
          this.getFiltros(filtro.establecimientoId).subscribe();
        }
      })
    );
  }

  // Eliminar un filtro
  deleteFiltro(filtroId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${filtroId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap((response: any) => {
        if (response.success) {
          // Actualizar el cache local eliminando el filtro
          const currentFiltros = this.filtrosSubject.value;
          const updatedFiltros = currentFiltros.filter(f => f.id_filtro !== filtroId);
          this.filtrosSubject.next(updatedFiltros);
        }
      })
    );
  }

  // Verificar si una canción está bloqueada
  checkIfBlocked(request: CheckBlockedRequest): Observable<CheckBlockedResponse> {
    return this.http.post<CheckBlockedResponse>(`${this.API_URL}/check`, request, {
      headers: this.getHeaders()
    });
  }

  // Verificar múltiples canciones
  checkMultipleSongs(establecimientoId: number, canciones: any[]): Observable<any> {
    return this.http.post(`${this.API_URL}/check-multiple`, {
      establecimientoId,
      canciones
    }, {
      headers: this.getHeaders()
    });
  }

  // Verificar si un artista está bloqueado (local)
  isArtistaBlocked(artista: string): boolean {
    const filtros = this.filtrosSubject.value;
    return filtros.some(f => f.tipo === 'artista' && f.valor === artista);
  }

  // Verificar si un género está bloqueado (local)
  isGeneroBlocked(genero: string): boolean {
    const filtros = this.filtrosSubject.value;
    return filtros.some(f => f.tipo === 'genero' && f.valor === genero);
  }

  // Verificar si una canción está bloqueada (local)
  isCancionBlocked(spotifyId: string): boolean {
    const filtros = this.filtrosSubject.value;
    return filtros.some(f => f.tipo === 'cancion' && f.valor === spotifyId);
  }

  // Obtener los filtros actuales del cache
  getCurrentFiltros(): Filtro[] {
    return this.filtrosSubject.value;
  }

  // Obtener un filtro específico por tipo y valor
  getFiltroByTipoAndValor(tipo: string, valor: string): Filtro | undefined {
    const filtros = this.filtrosSubject.value;
    return filtros.find(f => f.tipo === tipo && f.valor.toLowerCase() === valor.toLowerCase());
  }

  // Limpiar cache de filtros
  clearFiltrosCache(): void {
    this.filtrosSubject.next([]);
  }
}

