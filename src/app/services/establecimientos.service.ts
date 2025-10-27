import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Establecimiento {
  id_establecimiento: number;
  admin_id: number;
  nombre: string;
  url_menu?: string | null;
  ubicacion?: string | null;
  nombre_admin?: string | null;
}

export interface Mesa {
  id_mesa: number;
  numero_mesa: string;
  status: 'libre' | 'ocupada';
  establecimiento_id: number;
  qr_url?: string;
  qr_png?: string;
}

@Injectable({ providedIn: 'root' })
export class EstablecimientosService {
  private readonly API_URL = `${environment.apiUrl}/establecimientos`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getMiEstablecimiento(): Observable<{ success: boolean; establecimiento: Establecimiento | null }>{
    return this.http.get<{ success: boolean; establecimiento: Establecimiento | null }>(`${this.API_URL}/mio`, this.getAuthOptions());
  }

  upsertMiEstablecimiento(payload: { nombre: string; url_menu?: string; ubicacion?: string }): Observable<{ success: boolean; establecimiento: Establecimiento }>{
    return this.http.post<{ success: boolean; establecimiento: Establecimiento }>(`${this.API_URL}/mio`, payload, this.getAuthOptions());
  }

  listMesas(establecimientoId: number): Observable<{ success: boolean; mesas: Mesa[] }>{
    return this.http.get<{ success: boolean; mesas: Mesa[] }>(`${this.API_URL}/${establecimientoId}/mesas`, this.getAuthOptions());
  }

  createMesa(establecimientoId: number, numeroMesa: string): Observable<{ success: boolean; mesa: Mesa; qr_image?: string }>{
    return this.http.post<{ success: boolean; mesa: Mesa; qr_image?: string }>(`${this.API_URL}/mesas`, { establecimiento_id: establecimientoId, numero_mesa: numeroMesa }, this.getAuthOptions());
  }

  deleteLastMesa(establecimientoId: number): Observable<{ success: boolean; deleted: Mesa }>{
    return this.http.delete<{ success: boolean; deleted: Mesa }>(`${this.API_URL}/${establecimientoId}/mesas/ultima`, this.getAuthOptions());
  }

  private getAuthOptions(): { headers?: HttpHeaders } {
    const token = this.auth.getToken();
    if (!token) return {};
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  getBaseUrl(): string {
    return environment.apiUrl;
  }
}
