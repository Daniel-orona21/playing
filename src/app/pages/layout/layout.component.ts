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
import { ToastsComponent } from '../../components/toasts/toasts.component';
import { ToastService } from '../../services/toast.service';
import { LlamadasService, Llamada } from '../../services/llamadas.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, ToastsComponent],
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
  isChangingTrack = false;
  currentPosition = 0;
  duration = 0;
  progressPercent = 0;
  private progressInterval: any = null;
  
  private destroy$ = new Subject<void>();

  private unsubscribeTrackSkipped: (() => void) | null = null;
  private socket: any;
  private trackChangeListeners: Array<((event: any) => void) | (() => void)> = [];

  constructor(
    private router: Router,
    private playbackService: PlaybackService,
    private spotifyService: SpotifyService,
    private estService: EstablecimientosService,
    private queueManager: QueueManagerService,
    private musicaSocketService: MusicaSocketService,
    private ngZone: NgZone,
    private toastService: ToastService,
    private llamadasService: LlamadasService,
    private authService: AuthService
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

    this.playbackService.playbackState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const previousTrackId = this.currentTrack?.spotify_id;
        this.currentTrack = state.currentTrack;
        this.isPlaying = state.isPlaying;
        this.currentPosition = state.position;
        this.duration = state.duration;
        
        if (this.isChangingTrack && state.currentTrack) {
          if (previousTrackId !== state.currentTrack.spotify_id || (state.isPlaying && previousTrackId === state.currentTrack.spotify_id)) {
            setTimeout(() => {
              this.isChangingTrack = false;
            }, 500);
          }
        }
        
        if (this.duration > 0) {
          this.progressPercent = (this.currentPosition / this.duration) * 100;
        }
        
        this.value = Math.round(state.volume * 100);
        this.updateVolumeSlider();
        this.updateProgressSlider();
        
        if (state.isPlaying && !this.progressInterval) {
          this.startProgressInterval();
        } else if (!state.isPlaying && this.progressInterval) {
          this.stopProgressInterval();
        }
      });

    await this.restorePlayback();
    this.setupLlamadasSocket();
    this.setupTrackChangeListener();
  }

  private setupTrackChangeListener(): void {
    const trackChangingHandler = (event: any) => {
      this.ngZone.run(() => {
        this.isChangingTrack = true;
      });
    };
    
    const trackChangeFailedHandler = () => {
      this.ngZone.run(() => {
        this.isChangingTrack = false;
      });
    };
    
    window.addEventListener('trackChanging', trackChangingHandler);
    window.addEventListener('trackChangeFailed', trackChangeFailedHandler);
    
    this.trackChangeListeners = [trackChangingHandler, trackChangeFailedHandler];
  }

  private setupLlamadasSocket(): void {
    this.estService.getMiEstablecimiento().subscribe({
      next: async (response) => {
        if (response.success && response.establecimiento) {
          const establecimientoId = response.establecimiento.id_establecimiento;
          
          // Conectar socket
          const { io } = await import('socket.io-client');
          const baseUrl = this.estService.getBaseUrl().replace('/api', '');
          console.log('🔌 Conectando socket a:', baseUrl);
          this.socket = io(baseUrl, { 
            transports: ['websocket', 'polling'],
            reconnection: true 
          });
          
          // IMPORTANTE: Esperar a que el socket se conecte ANTES de unirse a la sala
          this.socket.on('connect', () => {
            console.log('✅ Socket conectado en layout');
            // Unirse a la sala del establecimiento DESPUÉS de conectar
            this.socket.emit('join_establecimiento', establecimientoId);
            console.log('📍 Unido a sala establecimiento:', establecimientoId);
          });
          
          this.socket.on('connect_error', (error: any) => {
            console.error('❌ Error de conexión socket:', error);
          });
          
          this.socket.on('disconnect', (reason: string) => {
            console.warn('⚠️ Socket desconectado:', reason);
          });
          
          // Escuchar eventos de llamadas
          this.socket.on('llamada_created', (llamada: Llamada) => {
            console.log('🔔 Layout: llamada_created recibida', llamada);
            this.ngZone.run(() => {
              console.log('📢 Emitiendo toast para llamada');
              this.toastService.showLlamada(
                llamada.usuario_nombre,
                llamada.numero_mesa,
                llamada.id_llamada
              );
            });
          });
          
          // Escuchar cuando una llamada es atendida para cerrar toasts
          this.socket.on('llamada_atendida', (data: { id_llamada: number }) => {
            console.log('✅ Layout: llamada_atendida recibida', data);
            // El toast se cerrará automáticamente por el componente de usuarios o por el propio toast
          });
        }
      },
      error: (error) => {
        console.error('Error al obtener establecimiento para sockets:', error);
      }
    });
  }

  private setupSkipListener(): void {
    // Limpiar listener anterior si existe
    if (this.unsubscribeTrackSkipped) {
      this.unsubscribeTrackSkipped();
      this.unsubscribeTrackSkipped = null;
    }
    
    this.unsubscribeTrackSkipped = this.musicaSocketService.on('track_skipped', (data: any) => {
      this.ngZone.run(async () => {
        if (data.establecimientoId === this.establecimientoId) {
          await this.queueManager.skipToNext();
        }
      });
    });
  }

  async restorePlayback() {
    try {
      this.isChangingTrack = true;
      
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        
        let isInitialized = false;
        this.playbackService.isInitialized$.subscribe(value => {
          isInitialized = value;
        }).unsubscribe();
        
        if (!isInitialized) {
          await this.playbackService.initialize(this.establecimientoId);
          await this.queueManager.initialize(this.establecimientoId);
          this.setupSkipListener();
        } else {
          this.setupSkipListener();
        }
        
        const response = await this.spotifyService.getCurrentPlaying(this.establecimientoId).toPromise();
        
        if (response?.success && response.currentPlaying) {
          const currentSong = response.currentPlaying;
          
          this.queueManager.setRestoringMode(true);
          
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
          
          this.queueManager.setCurrentQueueItem(currentSong.id);
          
          await this.playbackService.playTrack(currentSong.spotify_id, track);
          
          setTimeout(() => {
            this.queueManager.setRestoringMode(false);
          }, 2000);
        } else {
          this.isChangingTrack = false;
        }
      } else {
        this.isChangingTrack = false;
      }
    } catch (error) {
      console.error('Error restoring playback:', error);
      this.queueManager.setRestoringMode(false);
      this.isChangingTrack = false;
    }
  }

  ngOnDestroy() {
    this.stopProgressInterval();
    
    // Desuscribirse del evento de skip
    if (this.unsubscribeTrackSkipped) {
      this.unsubscribeTrackSkipped();
      this.unsubscribeTrackSkipped = null;
    }
    
    // Remover event listeners de cambio de canción
    if (this.trackChangeListeners.length > 0) {
      window.removeEventListener('trackChanging', this.trackChangeListeners[0]);
      window.removeEventListener('trackChangeFailed', this.trackChangeListeners[1]);
      this.trackChangeListeners = [];
    }
    
    // Cerrar socket de llamadas
    if (this.socket) {
      this.socket.close();
      this.socket = null;
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

    this.isChangingTrack = true;
    
    try {
      await this.queueManager.skipToNext();
    } catch (error) {
      console.error('Error al cambiar de canción:', error);
      this.isChangingTrack = false;
    }
  }

  async previousTrack() {
    if (!this.currentTrack) {
      return;
    }

    try {
      await this.playbackService.seek(0);
      const currentState = this.playbackService.getCurrentState();
      if (!currentState.isPlaying) {
        await this.playbackService.resume();
      }
    } catch (error) {
      console.error('Error al reiniciar canción:', error);
    }
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
