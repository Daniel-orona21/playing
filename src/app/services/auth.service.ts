import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  nombre: string;
  email: string;
  roll: 'admin' | 'cliente';
  mesa_id_activa?: number;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadStoredAuth();
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        const userData = JSON.parse(user);
        this.tokenSubject.next(token);
        this.currentUserSubject.next(userData);
      } catch (error) {
        // Si hay error al parsear, limpiar datos
        this.logout();
      }
    }
  }

  async loginWithGoogle(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Cargar la librería de Google
        await this.loadGoogleScript();
        
        // Inicializar Google Identity Services
        const google = (window as any).google;
        const client = google.accounts.oauth2.initCodeClient({
          client_id: this.getGoogleClientId(),
          scope: 'openid email profile',
          callback: async (response: any) => {
            try {
              console.log('Callback de Google recibido, procesando...');
              await this.handleGoogleResponse(response.code);
              console.log('Procesamiento completado, resolviendo...');
              resolve();
            } catch (error) {
              console.error('Error en callback de Google:', error);
              reject(error);
            }
          }
        });

        // Solicitar autorización
        client.requestCode();
      } catch (error) {
        console.error('Error al cargar Google:', error);
        reject(error);
      }
    });
  }

  private getGoogleClientId(): string {
    // Obtener el Client ID desde variables de entorno
    return environment.googleClientId;
  }

  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Error al cargar Google script'));
      document.head.appendChild(script);
    });
  }

  private async handleGoogleResponse(code: string): Promise<void> {
    // Intercambiar el código por un token
    await this.exchangeCodeForTokens(code);
  }

  private exchangeCodeForTokens(code: string): Promise<void> {
    // Enviar el código al backend para que lo intercambie por tokens
    return new Promise((resolve, reject) => {
      this.http.post<AuthResponse>(`${this.API_URL}/google/admin`, { code })
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.setAuthData(response.token, response.user);
              console.log('Login exitoso:', response.user);
              resolve();
            } else {
              reject(new Error('Error en la respuesta del servidor'));
            }
          },
          error: (error) => {
            console.error('Error en autenticación:', error);
            reject(error);
          }
        });
    });
  }

  private setAuthData(token: string, user: User): void {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${this.API_URL}/logout`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).subscribe({
        next: () => {},
        error: () => {},
      });
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.roll === 'admin';
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  // Método para verificar el token con el backend
  verifyToken(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No hay token disponible');
    }

    return this.http.get(`${this.API_URL}/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
}
