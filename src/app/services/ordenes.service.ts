import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Orden {
  id_orden: number;
  numero_orden?: string;
  status: 'pendiente' | 'en_preparacion' | 'entregada' | 'pagada';
  total_monto: number;
  tiempo_estimado: number;
  tiempo_anadido: number;
  creada_en: string;
  actualizado_en: string;
  usuario_id: number;
  usuario_nombre: string;
  mesa_id: number;
  mesa_numero: string;
}

export interface UsuarioActivo {
  id_user: number;
  nombre: string;
  email: string;
  id_mesa: number;
  numero_mesa: string;
}

export interface CreateOrdenData {
  usuario_id: number;
  mesa_id: number;
  numero_orden?: string;
  total_monto: number;
  tiempo_estimado: number;
  establecimientoId?: number;
}

export interface UsuarioConEstado {
  id: number;
  nombre: string;
  mesa: number;
  estado: string;
  total_ordenes: number;
  ordenes_pendientes: number;
  ordenes_entregadas: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrdenesService {
  private readonly API_URL = `${environment.apiUrl}/ordenes`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Obtener todas las órdenes de un establecimiento
  getOrdenes(establecimientoId: number): Observable<{ success: boolean; ordenes: Orden[] }> {
    return this.http.get<{ success: boolean; ordenes: Orden[] }>(
      `${this.API_URL}/${establecimientoId}`,
      { headers: this.getHeaders() }
    );
  }

  // Obtener usuarios activos (con mesa asignada) de un establecimiento
  getUsuariosActivos(establecimientoId: number): Observable<{ success: boolean; usuarios: UsuarioActivo[] }> {
    return this.http.get<{ success: boolean; usuarios: UsuarioActivo[] }>(
      `${this.API_URL}/usuarios-activos/${establecimientoId}`,
      { headers: this.getHeaders() }
    );
  }

  // Crear una nueva orden
  createOrden(data: CreateOrdenData): Observable<{ success: boolean; mensaje: string; orden: Orden }> {
    return this.http.post<{ success: boolean; mensaje: string; orden: Orden }>(
      this.API_URL,
      data,
      { headers: this.getHeaders() }
    );
  }

  // Actualizar el estado de una orden
  updateOrdenStatus(
    id: number, 
    status: string, 
    establecimientoId?: number
  ): Observable<{ success: boolean; mensaje: string }> {
    return this.http.put<{ success: boolean; mensaje: string }>(
      `${this.API_URL}/${id}/status`,
      { status, establecimientoId },
      { headers: this.getHeaders() }
    );
  }

  // Actualizar el tiempo añadido de una orden (envía el ajuste +/-)
  updateOrdenTiempo(
    id: number, 
    ajuste: number, 
    establecimientoId?: number
  ): Observable<{ success: boolean; mensaje: string }> {
    return this.http.put<{ success: boolean; mensaje: string }>(
      `${this.API_URL}/${id}/tiempo`,
      { ajuste, establecimientoId },
      { headers: this.getHeaders() }
    );
  }

  // Eliminar múltiples órdenes
  deleteOrdenes(ids: number[], establecimientoId?: number): Observable<{ success: boolean; mensaje: string }> {
    return this.http.request<{ success: boolean; mensaje: string }>(
      'DELETE',
      this.API_URL,
      {
        headers: this.getHeaders(),
        body: { ids, establecimientoId }
      }
    );
  }

  // Obtener el estado de las órdenes por usuario
  getEstadoOrdenesUsuarios(establecimientoId: number): Observable<{ success: boolean; usuarios: UsuarioConEstado[] }> {
    return this.http.get<{ success: boolean; usuarios: UsuarioConEstado[] }>(
      `${this.API_URL}/estado-usuarios/${establecimientoId}`,
      { headers: this.getHeaders() }
    );
  }
}

