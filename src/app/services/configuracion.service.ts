import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConfiguracionLimites {
  limiteReproduccionCancion: '1_hora' | '2_horas' | 'sin_limite';
  limitePeticionesUsuarioHora: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private readonly API_URL = `${environment.apiUrl}/configuracion`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Obtener configuración de límites
  getConfiguracion(establecimientoId: number): Observable<any> {
    return this.http.get(`${this.API_URL}?establecimientoId=${establecimientoId}`, {
      headers: this.getHeaders()
    });
  }

  // Actualizar configuración de límites
  updateConfiguracion(
    establecimientoId: number,
    limiteReproduccionCancion?: '1_hora' | '2_horas' | 'sin_limite',
    limitePeticionesUsuarioHora?: number
  ): Observable<any> {
    const body: any = { establecimientoId };
    
    if (limiteReproduccionCancion) {
      body.limiteReproduccionCancion = limiteReproduccionCancion;
    }
    
    if (limitePeticionesUsuarioHora !== undefined) {
      body.limitePeticionesUsuarioHora = limitePeticionesUsuarioHora;
    }

    return this.http.put(this.API_URL, body, {
      headers: this.getHeaders()
    });
  }
}



