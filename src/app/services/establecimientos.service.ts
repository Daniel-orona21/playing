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

  private getAuthOptions(): { headers?: HttpHeaders } {
    const token = this.auth.getToken();
    if (!token) return {};
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }
}
