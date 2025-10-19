import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SpotifyService } from '../../services/spotify.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback-spotify',
    imports: [CommonModule], // 👈 AGREGA ESTO
  template: `
    <div class="callback-container">
      <div class="loading-spinner" *ngIf="isLoading">
        <div class="spinner"></div>
        <p class="texto">Conectando con Spotify...</p>
      </div>
      
      <div class="error-message" *ngIf="error">
        <h3>Error al conectar con Spotify</h3>
        <p>{{ error }}</p>
        <button (click)="goToSettings()" class="btn-primary">
          Volver a Ajustes
        </button>
      </div>
      
      <div class="success-message" *ngIf="success">
        <h3>¡Conectado exitosamente!</h3>
        <p>Tu cuenta de Spotify ha sido conectada correctamente.</p>
        <button (click)="goToSettings()" class="btn-primary">
          Continuar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      background: black;
      color: white;
      text-align: center;
    }

    .texto {
      color: white;
      font-size: 10rem;
    }

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-message, .success-message {
      background: rgba(255, 255, 255, 0.1);
      padding: 2rem;
      border-radius: 15px;
      backdrop-filter: blur(10px);
      max-width: 400px;
    }

    .error-message h3 {
      color: #ff6b6b;
      margin-bottom: 1rem;
    }

    .success-message h3 {
      color: #4ecdc4;
      margin-bottom: 1rem;
    }

    .btn-primary {
      background: white;
      color: #1db954;
      border: none;
      padding: 12px 24px;
      border-radius: 25px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 1rem;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
  `]
})
export class CallbackSpotifyComponent implements OnInit {
  isLoading = true;
  error: string | null = null;
  success = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private spotifyService: SpotifyService
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('CallbackSpotifyComponent inicializado');
    console.log('URL actual:', window.location.href);
    console.log('Query params:', this.route.snapshot.queryParams);
    
    try {
      // Obtener parámetros de la URL
      const code = this.route.snapshot.queryParams['code'];
      const state = this.route.snapshot.queryParams['state'];
      const error = this.route.snapshot.queryParams['error'];

      console.log('Code:', code);
      console.log('State:', state);
      console.log('Error:', error);

      if (error) {
        this.error = 'Spotify rechazó la autorización. Por favor, intenta de nuevo.';
        this.isLoading = false;
        return;
      }

      if (!code || !state) {
        this.error = 'Parámetros de autorización faltantes. Por favor, intenta de nuevo.';
        this.isLoading = false;
        return;
      }

      console.log('Procesando callback...');
      // Procesar el callback
      await this.spotifyService.handleCallback(code, state);
      
      this.success = true;
      this.isLoading = false;

      // Redirigir después de 2 segundos
      setTimeout(() => {
        this.goToSettings();
      }, 2000);

    } catch (error: any) {
      console.error('Error in Spotify callback:', error);
      this.error = error.message || 'Error desconocido al conectar con Spotify';
      this.isLoading = false;
    }
  }

  goToSettings(): void {
    this.router.navigate(['/secciones/ajustes']);
  }
}
