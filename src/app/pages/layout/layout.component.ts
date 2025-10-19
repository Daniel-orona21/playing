import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { SpotifyService, SpotifyPlaybackState } from '../../services/spotify.service';
import { EstablecimientosService } from '../../services/establecimientos.service';

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
  public pause = true; // Inicialmente pausado
  value = 75;
  selectedNavItem: string = 'music';
  
  // Estado de reproducción
  currentTrack: any = null;
  isPlaying = false; // Inicialmente no reproduciendo
  establecimientoId: number | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private spotifyService: SpotifyService,
    private estService: EstablecimientosService
  ) {}

  async ngOnInit() {
    this.updateSelectedNavFromUrl();
    
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedNavFromUrl();
      });

    // Obtener el establecimiento actual
    try {
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('Establecimiento ID obtenido en layout:', this.establecimientoId);
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento en layout:', error);
    }

    // NO suscribirse al estado de reproducción para evitar cambios automáticos

    // Escuchar eventos de canción reproducida - solo actualizar la canción
    window.addEventListener('spotifyTrackPlayed', (event: any) => {
      const { track } = event.detail;
      this.currentTrack = track;
      // NO cambiar isPlaying ni pause automáticamente
      console.log('Canción actualizada desde evento:', track);
    });

    // Cargar canción actual al inicializar
    if (this.establecimientoId) {
      this.loadCurrentTrack();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
    try {
      if (this.pause) {
        // Reproducir
        if (this.currentTrack && this.establecimientoId) {
          console.log('🎵 Starting playback...');
          
          // Si no hay reproductor, inicializarlo y cargar la canción
          if (!this.spotifyService['player']) {
            await this.spotifyService.initializePlayer(this.establecimientoId);
            await this.spotifyService.waitForDevice();
            await this.spotifyService.loadTrack(this.currentTrack, this.establecimientoId);
          }
          
          await this.spotifyService.resumePlayback();
          this.pause = false;
          this.isPlaying = true;
          console.log('✅ Playback started');
        }
      } else {
        // Pausar
        console.log('⏸️ Pausing playback...');
        await this.spotifyService.pausePlayback();
        this.pause = true;
        this.isPlaying = false;
        console.log('✅ Playback paused');
      }
    } catch (error) {
      console.error('Error controlling playback:', error);
    }
  }

  async skipToNext() {
    try {
      await this.spotifyService.skipToNext();
    } catch (error) {
      console.error('Error skipping to next track:', error);
    }
  }

  async skipToPrevious() {
    try {
      await this.spotifyService.skipToPrevious();
    } catch (error) {
      console.error('Error skipping to previous track:', error);
    }
  }

  async updateValue(event: Event) {
    const input = event.target as HTMLInputElement;
    const percent = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty('--value', percent + '%');
    
    try {
      await this.spotifyService.setVolume(parseInt(input.value));
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  selectNavItem(item: string) {
    this.selectedNavItem = item;
    this.router.navigate(['/layout', item]);
  }

  prepareRoute(outlet: RouterOutlet) {
    if (!outlet || !outlet.activatedRouteData) {
      return 'default';
    }
    return outlet.activatedRouteData['animation'] || 'default';
  }

  async loadCurrentTrack() {
    try {
      if (!this.establecimientoId) return;
      
      const response = await this.spotifyService.getCurrentPlaying(this.establecimientoId).toPromise();
      if (response?.success && response.currentTrack) {
        this.currentTrack = response.currentTrack;
        // NO cambiar isPlaying ni pause - mantener estado inicial
        console.log('Canción actual cargada:', this.currentTrack);
        console.log('✅ Canción mostrada en header (pausada)');
        
        // Inicializar el reproductor para que esté listo
        try {
          await this.spotifyService.initializePlayer(this.establecimientoId);
          console.log('✅ Reproductor inicializado y listo');
          
          // Esperar a que el dispositivo esté listo antes de cargar la canción
          await this.spotifyService.waitForDevice();
          console.log('✅ Dispositivo listo');
          
          // Cargar la canción en el reproductor (sin reproducir)
          await this.spotifyService.loadTrack(this.currentTrack, this.establecimientoId);
          console.log('✅ Canción cargada en reproductor');
        } catch (initError) {
          console.warn('⚠️ No se pudo inicializar el reproductor:', initError);
        }
      }
    } catch (error) {
      console.error('Error loading current track:', error);
    }
  }

}
