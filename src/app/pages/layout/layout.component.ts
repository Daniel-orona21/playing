import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { SpotifyService } from '../../services/spotify.service';
import { ColaCancion } from '../../models/musica.interfaces';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('300ms ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class LayoutComponent implements OnInit, OnDestroy {
  public pause = false;
  value = 75;
  selectedNavItem: string = 'music';
  
  // Spotify integration
  currentTrack: ColaCancion | null = null;
  isSpotifyConnected = false;
  establecimientoId = 4; // Usar el mismo ID que funciona en el SpotifyService
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private spotifyService: SpotifyService
  ) {}

  ngOnInit() {
    console.log('LayoutComponent: Initializing with establecimientoId:', this.establecimientoId);
    this.updateSelectedNavFromUrl();
    this.initializeSpotify();
    
    // Escuchar evento personalizado de Spotify
    window.addEventListener('spotifyTrackPlayed', this.handleSpotifyTrackPlayed);
    
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedNavFromUrl();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Limpiar event listener personalizado
    window.removeEventListener('spotifyTrackPlayed', this.handleSpotifyTrackPlayed);
  }
  
  private handleSpotifyTrackPlayed = (event: any) => {
    console.log('Layout: Received custom Spotify event:', event.detail);
    this.forceUpdateTrackInfo(event.detail.track);
  }

  private async initializeSpotify() {
    console.log('Layout: Setting up Spotify subscriptions...');
    
    // Solo configurar la suscripción a isConnected$ por ahora
    this.spotifyService.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        console.log('Layout: Connection status changed:', connected);
        this.isSpotifyConnected = connected;
        if (connected) {
          this.loadCurrentTrack();
        }
      });

    // Configurar la suscripción a playbackState$ DESPUÉS de que se reproduzca algo
    this.spotifyService.playbackState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        console.log('Layout: Received playback state:', state);
        if (state) {
          console.log('Layout: Playback state changed:', state);
          this.pause = !state.isPlaying;
          console.log('Layout: Setting pause to:', this.pause);
          
          if (state.track) {
            console.log('Layout: Setting current track:', state.track);
            this.currentTrack = {
              id: 0,
              cancion_id: 0,
              cancion: state.track,
              anadido_por: 0,
              usuario: { nombre: 'Sistema' },
              posicion: 0,
              status: state.isPlaying ? 'playing' : 'pending',
              agregada_en: new Date().toISOString()
            };
            console.log('Layout: Current track set to:', this.currentTrack);
          } else {
            console.log('Layout: No track info available');
            this.currentTrack = null;
          }
        } else {
          console.log('Layout: No playback state');
          this.currentTrack = null;
        }
      });

    // NO intentar auto-inicializar aquí, solo configurar suscripciones
    console.log('Layout: Spotify subscriptions configured, waiting for playback...');
  }

  private loadCurrentTrack() {
    this.spotifyService.getCurrentPlaying(this.establecimientoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        if (response.success) {
          this.currentTrack = response.currentTrack;
        }
      });
  }


  private updateSelectedNavFromUrl() {
    const url = this.router.url;
    if (url.includes('/layout/music') || url === '/layout') {
      this.selectedNavItem = 'music';
    } else if (url.includes('/layout/ordenes')) {
      this.selectedNavItem = 'ordenes';
    } else if (url.includes('/layout/games')) {
      this.selectedNavItem = 'games';
    } else if (url.includes('/layout/settings')) {
      this.selectedNavItem = 'settings';
    }
  }

  async play() {
    if (!this.isSpotifyConnected) {
      console.warn('Spotify no está conectado');
      return;
    }

    try {
      if (this.pause) {
        await this.spotifyService.resumePlayback();
      } else {
        await this.spotifyService.pausePlayback();
      }
    } catch (error) {
      console.error('Error controlling playback:', error);
    }
  }

  async skipToNext() {
    if (!this.isSpotifyConnected) {
      console.warn('Spotify no está conectado');
      return;
    }

    try {
      await this.spotifyService.skipToNext();
      // Recargar canción actual después de cambiar
      setTimeout(() => this.loadCurrentTrack(), 1000);
    } catch (error) {
      console.error('Error skipping to next:', error);
    }
  }

  async skipToPrevious() {
    if (!this.isSpotifyConnected) {
      console.warn('Spotify no está conectado');
      return;
    }

    try {
      await this.spotifyService.skipToPrevious();
      // Recargar canción actual después de cambiar
      setTimeout(() => this.loadCurrentTrack(), 1000);
    } catch (error) {
      console.error('Error skipping to previous:', error);
    }
  }

  async updateValue(event: Event) {
    const input = event.target as HTMLInputElement;
    const percent = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty('--value', percent + '%');
    
    // Actualizar volumen en Spotify
    if (this.isSpotifyConnected) {
      try {
        await this.spotifyService.setVolume(+input.value);
      } catch (error) {
        console.error('Error setting volume:', error);
      }
    }
  }

  selectNavItem(item: string) {
    this.selectedNavItem = item;
    this.router.navigate(['/layout', item]);
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet?.activatedRouteData?.['animation'] || 'default';
  }

  // Método para forzar actualización cuando se reproduce una canción
  forceUpdateTrackInfo(track: any) {
    console.log('Layout: Force updating track info:', track);
    this.currentTrack = {
      id: 0,
      cancion_id: 0,
      cancion: track,
      anadido_por: 0,
      usuario: { nombre: 'Sistema' },
      posicion: 0,
      status: 'playing',
      agregada_en: new Date().toISOString()
    };
    this.pause = false;
    this.isSpotifyConnected = true;
    console.log('Layout: Track info force updated:', this.currentTrack);
  }
}
