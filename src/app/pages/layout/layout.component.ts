import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { PlaybackService } from '../../services/playback.service';
import { SpotifyService } from '../../services/spotify.service';
import { EstablecimientosService } from '../../services/establecimientos.service';
import { QueueManagerService } from '../../services/queue-manager.service';
import { SpotifyTrack } from '../../models/musica.interfaces';

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
  value = 75;
  selectedNavItem: string = 'music';
  currentTrack: SpotifyTrack | null = null;
  isPlaying = false;
  establecimientoId: number | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private playbackService: PlaybackService,
    private spotifyService: SpotifyService,
    private estService: EstablecimientosService,
    private queueManager: QueueManagerService
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

    // Suscribirse al estado del reproductor
    this.playbackService.playbackState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.currentTrack = state.currentTrack;
        this.isPlaying = state.isPlaying;
        
        // Actualizar el valor del volumen en el slider
        this.value = Math.round(state.volume * 100);
        this.updateVolumeSlider();
      });

    // Obtener establecimiento y restaurar reproducción
    await this.restorePlayback();
  }

  async restorePlayback() {
    try {
      // Obtener el establecimiento actual
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('🔄 Establecimiento ID obtenido:', this.establecimientoId);
        
        // Inicializar el reproductor de Spotify
        let isInitialized = false;
        this.playbackService.isInitialized$.subscribe(value => {
          isInitialized = value;
        }).unsubscribe();
        
        if (!isInitialized) {
          console.log('🔄 Initializing playback service...');
          await this.playbackService.initialize(this.establecimientoId);
          
          // Inicializar el gestor de cola
          console.log('🔄 Initializing queue manager...');
          await this.queueManager.initialize(this.establecimientoId);
        }
        
        // Buscar si hay una canción actualmente en reproducción
        console.log('🔍 Checking for current playing song...');
        const response = await this.spotifyService.getCurrentPlaying(this.establecimientoId).toPromise();
        
        if (response?.success && response.currentPlaying) {
          const currentSong = response.currentPlaying;
          console.log('✅ Found current playing song:', currentSong.titulo);
          
          // ✅ ACTIVAR MODO RESTAURACIÓN (desactiva la lógica automática del QueueManager)
          this.queueManager.setRestoringMode(true);
          
          // Crear objeto SpotifyTrack
          const track: SpotifyTrack = {
            spotify_id: currentSong.spotify_id,
            titulo: currentSong.titulo,
            artista: currentSong.artista,
            album: currentSong.album,
            duracion: currentSong.duracion,
            imagen_url: currentSong.imagen_url,
            genero: currentSong.genero,
            preview_url: currentSong.preview_url
          };
          
          // Establecer el ID actual en el queue manager
          this.queueManager.setCurrentQueueItem(currentSong.id);
          
          // Reproducir la canción (sin activar lógica de cola)
          console.log('🎵 Restoring playback...');
          await this.playbackService.playTrack(currentSong.spotify_id, track);
          
          // ✅ Esperar un poco y DESACTIVAR MODO RESTAURACIÓN
          setTimeout(() => {
            this.queueManager.setRestoringMode(false);
            console.log('✅ Playback restored successfully!');
          }, 2000); // Esperar 2 segundos antes de reactivar la lógica automática
          
        } else {
          console.log('ℹ️ No current playing song found');
        }
      }
    } catch (error) {
      console.error('❌ Error restoring playback:', error);
      // Asegurarse de desactivar el modo restauración en caso de error
      this.queueManager.setRestoringMode(false);
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

  async updateValue(event: Event) {
    const input = event.target as HTMLInputElement;
    const percent = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty('--value', percent + '%');
    
    // Actualizar el volumen en el servicio de playback
    const volume = +input.value / 100; // Convertir de 0-100 a 0-1
    await this.playbackService.setVolume(volume);
  }

  private updateVolumeSlider() {
    // Actualizar visualmente el slider de volumen
    setTimeout(() => {
      const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
      if (slider) {
        const percent = ((this.value - +slider.min) / (+slider.max - +slider.min)) * 100;
        slider.style.setProperty('--value', percent + '%');
      }
    }, 0);
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

  async togglePlay() {
    if (!this.currentTrack) {
      return;
    }

    await this.playbackService.togglePlay();
  }

  async nextTrack() {
    if (!this.currentTrack) {
      return;
    }

    await this.playbackService.nextTrack();
  }

  async previousTrack() {
    if (!this.currentTrack) {
      return;
    }

    await this.playbackService.previousTrack();
  }
}
