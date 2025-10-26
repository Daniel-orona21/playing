import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { PlaybackService } from '../../services/playback.service';
import { SpotifyService } from '../../services/spotify.service';
import { EstablecimientosService } from '../../services/establecimientos.service';
import { QueueManagerService } from '../../services/queue-manager.service';
import { MusicaSocketService } from '../../services/musica-socket.service';
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
  
  // Progress tracking
  currentPosition = 0; // en milisegundos
  duration = 0; // en milisegundos
  progressPercent = 0;
  private progressInterval: any = null;
  
  private destroy$ = new Subject<void>();

  private unsubscribeTrackSkipped: (() => void) | null = null;

  constructor(
    private router: Router,
    private playbackService: PlaybackService,
    private spotifyService: SpotifyService,
    private estService: EstablecimientosService,
    private queueManager: QueueManagerService,
    private musicaSocketService: MusicaSocketService,
    private ngZone: NgZone
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
        this.currentPosition = state.position;
        this.duration = state.duration;
        
        // Calcular porcentaje de progreso
        if (this.duration > 0) {
          this.progressPercent = (this.currentPosition / this.duration) * 100;
        }
        
        // Actualizar el valor del volumen en el slider
        this.value = Math.round(state.volume * 100);
        this.updateVolumeSlider();
        this.updateProgressSlider();
        
        // Manejar el intervalo de actualización de progreso
        if (state.isPlaying && !this.progressInterval) {
          this.startProgressInterval();
        } else if (!state.isPlaying && this.progressInterval) {
          this.stopProgressInterval();
        }
      });

    // Obtener establecimiento y restaurar reproducción
    await this.restorePlayback();
  }

  private setupSkipListener(): void {
    this.unsubscribeTrackSkipped = this.musicaSocketService.on('track_skipped', (data: any) => {
      this.ngZone.run(async () => {
        console.log('⏭️ Layout: Recibido evento track_skipped:', data);
        
        // Verificar si es para el establecimiento actual
        if (data.establecimientoId === this.establecimientoId) {
          console.log('⏭️ Layout: Ejecutando skipToNext() automáticamente...');
          
          // Ejecutar el skip usando el QueueManager que maneja toda la lógica
          await this.queueManager.skipToNext();
        }
      });
    });
  }

  async restorePlayback() {
    try {
      // Obtener el establecimiento actual
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('🔄 Establecimiento ID obtenido:', this.establecimientoId);
        
        // Configurar listener de skip DESPUÉS de tener el establecimientoId
        this.setupSkipListener();
        
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
    this.stopProgressInterval();
    
    // Desuscribirse del evento de skip
    if (this.unsubscribeTrackSkipped) {
      this.unsubscribeTrackSkipped();
      this.unsubscribeTrackSkipped = null;
    }
    
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

  /**
   * Actualiza el progreso de la canción cada segundo mientras está reproduciendo
   */
  private startProgressInterval() {
    this.stopProgressInterval(); // Asegurar que no haya múltiples intervalos
    
    this.progressInterval = setInterval(() => {
      if (this.isPlaying && this.duration > 0) {
        // Incrementar posición
        this.currentPosition = Math.min(this.currentPosition + 1000, this.duration);
        this.progressPercent = (this.currentPosition / this.duration) * 100;
        this.updateProgressSlider();
      }
    }, 1000);
  }

  /**
   * Detiene el intervalo de actualización de progreso
   */
  private stopProgressInterval() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Maneja el cambio de posición en el slider de progreso
   */
  async updateProgress(event: Event) {
    const input = event.target as HTMLInputElement;
    const percent = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty('--progress-value', percent + '%');
    
    // Calcular nueva posición en milisegundos
    const newPosition = (this.duration * +input.value) / 100;
    this.currentPosition = newPosition;
    this.progressPercent = +input.value;
    
    // Buscar en la canción
    await this.playbackService.seek(Math.floor(newPosition));
  }

  /**
   * Actualiza visualmente el slider de progreso
   */
  private updateProgressSlider() {
    setTimeout(() => {
      const slider = document.querySelector('.progress-slider') as HTMLInputElement;
      if (slider) {
        const percent = this.progressPercent;
        slider.style.setProperty('--progress-value', percent + '%');
      }
    }, 0);
  }

  /**
   * Formatea el tiempo de milisegundos a MM:SS
   */
  formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  abrirVista() {
  if (this.establecimientoId) {
    const token = localStorage.getItem('token');
    const url = token
      ? `/vista/${this.establecimientoId}?token=${encodeURIComponent(token)}`
      : `/vista/${this.establecimientoId}`;

    window.open(
      url,
      'VistaNueva', 
      'width=900,height=700,left=200,top=100,resizable=yes,scrollbars=yes'
    );
  } else {
    console.error('No hay establecimientoId disponible');
  }
}
}
