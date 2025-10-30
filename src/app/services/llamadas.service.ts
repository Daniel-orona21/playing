import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Llamada {
  id_llamada: number;
  usuario_id: number;
  establecimiento_id: number;
  mesa_id: number;
  status: 'pendiente' | 'atendida' | 'cancelada';
  creada_en: string;
  atendida_en?: string;
  usuario_nombre: string;
  numero_mesa: string;
}

@Injectable({
  providedIn: 'root'
})
export class LlamadasService {
  private readonly API_URL = `${environment.apiUrl}/llamadas`;

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

  // Crear una nueva llamada (cliente)
  createLlamada(): Observable<{ success: boolean; mensaje: string; llamada: Llamada }> {
    return this.http.post<{ success: boolean; mensaje: string; llamada: Llamada }>(
      this.API_URL,
      {},
      { headers: this.getHeaders() }
    );
  }

  // Obtener llamadas pendientes de un establecimiento (admin)
  getLlamadasPendientes(establecimientoId: number): Observable<{ success: boolean; llamadas: Llamada[] }> {
    return this.http.get<{ success: boolean; llamadas: Llamada[] }>(
      `${this.API_URL}/${establecimientoId}/pendientes`,
      { headers: this.getHeaders() }
    );
  }

  // Marcar llamada como atendida (admin)
  marcarLlamadaAtendida(id: number): Observable<{ success: boolean; mensaje: string }> {
    return this.http.put<{ success: boolean; mensaje: string }>(
      `${this.API_URL}/${id}/atender`,
      {},
      { headers: this.getHeaders() }
    );
  }

  // Cancelar llamada (cliente)
  cancelarLlamada(id: number): Observable<{ success: boolean; mensaje: string }> {
    return this.http.put<{ success: boolean; mensaje: string }>(
      `${this.API_URL}/${id}/cancelar`,
      {},
      { headers: this.getHeaders() }
    );
  }
}


