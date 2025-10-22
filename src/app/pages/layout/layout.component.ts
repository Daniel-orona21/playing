import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { SpotifyService, SpotifyPlaybackState } from '../../services/spotify.service';
import { EstablecimientosService } from '../../services/establecimientos.service';
import { MusicPlayerService } from '../../services/music-player.service';

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
    private estService: EstablecimientosService,
    private musicPlayerService: MusicPlayerService
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

    // Escuchar eventos de canción reproducida - actualizar la canción y UI
    window.addEventListener('spotifyTrackPlayed', (event: any) => {
      const { track, isPlaying } = event.detail;
      this.currentTrack = track;
      this.isPlaying = isPlaying || false;
      this.pause = !isPlaying;
      console.log('Canción actualizada desde evento:', track);
      console.log('Estado de reproducción:', isPlaying ? 'Reproduciendo' : 'Pausado');
    });

    // Escuchar solicitudes de skip desde otros componentes
    window.addEventListener('musicPlayerPlayRequest', async (event: any) => {
      const { track, establecimientoId } = event.detail;
      console.log('🎵 Layout: Solicitud de reproducción recibida para:', track.titulo);
      
      try {
        // Verificar si hay una canción reproduciéndose actualmente
        const currentTrack = await this.spotifyService.getCurrentPlayingTrack(establecimientoId);
        
        if (currentTrack) {
          // Si hay canción actual, usar flujo normal
          const userId = 1;
          await this.spotifyService.addToQueueAndPlay(track, userId, establecimientoId);
          await this.skipToNext();
        } else {
          // Si no hay canción actual, usar flujo de reproducción inicial
          await this.handleInitialPlayback(track, establecimientoId);
        }
      } catch (error) {
        console.error('Error manejando solicitud de reproducción:', error);
      }
    });

    // Escuchar solicitudes de reproducción inicial (cuando no hay música sonando)
    window.addEventListener('musicPlayerInitialPlayRequest', async (event: any) => {
      const { track, establecimientoId } = event.detail;
      console.log('🎵 Layout: Solicitud de reproducción inicial recibida para:', track.titulo);
      
      try {
        await this.handleInitialPlayback(track, establecimientoId);
      } catch (error) {
        console.error('Error manejando reproducción inicial:', error);
      }
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
      if (this.establecimientoId) {
        const userId = 1; // Hardcoded for now - TODO: get from auth service
        await this.spotifyService.skipToNext(this.establecimientoId, userId);
        
        // Recargar la canción actual después del cambio
        await this.loadCurrentTrack();
      }
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
        // Extraer la información de la canción del objeto de respuesta
        const trackData = response.currentTrack.cancion || response.currentTrack;
        this.currentTrack = {
          spotify_id: trackData.spotify_id,
          titulo: trackData.titulo,
          artista: trackData.artista,
          album: trackData.album,
          duracion: trackData.duracion,
          imagen_url: trackData.imagen_url,
          genero: trackData.genero,
          preview_url: trackData.preview_url
        };
        
        console.log('Canción actual cargada:', this.currentTrack);
        console.log('✅ Canción mostrada en header');
        
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
      } else {
        console.log('No hay canción reproduciéndose actualmente');
        this.currentTrack = null;
      }
    } catch (error) {
      console.error('Error loading current track:', error);
    }
  }

  // Método para manejar reproducción inicial (cuando no hay música sonando)
  private async handleInitialPlayback(track: any, establecimientoId: number): Promise<void> {
    try {
      console.log('🎵 Iniciando reproducción inicial para:', track.titulo);
      
      // PASO 1: Agregar a la cola (actualizar BD) como PENDING (no playing aún)
      const userId = 1;
      await this.spotifyService.addToQueue(track, userId, establecimientoId).toPromise();
      console.log('✅ BD actualizada - canción agregada como PENDING');
      
      // PASO 2: Inicializar reproductor si es necesario
      if (!this.spotifyService['player']) {
        console.log('🔄 Inicializando reproductor...');
        await this.spotifyService.initializePlayer(establecimientoId);
        await this.spotifyService.waitForDevice();
        console.log('✅ Reproductor inicializado');
      }
      
      // PASO 3: Cargar la canción usando playTrack (esto carga Y reproduce)
      console.log('🎵 Cargando y reproduciendo canción...');
      await this.spotifyService.playTrack(track, establecimientoId);
      
      // PASO 4: Actualizar estado de la UI
      this.currentTrack = track;
      this.isPlaying = true;
      this.pause = false;
      
      // PASO 5: Solo después de que realmente empiece a sonar, marcar como playing en BD
      console.log('🔄 Marcando canción como PLAYING en BD...');
      await this.markTrackAsPlaying(track, establecimientoId);
      console.log('✅ Reproducción iniciada correctamente');
      
    } catch (error) {
      console.error('Error en reproducción inicial:', error);
    }
  }

  // Método helper para marcar una canción como playing en la BD
  private async markTrackAsPlaying(track: any, establecimientoId: number): Promise<void> {
    try {
      // Buscar la canción en la cola y marcarla como playing
      const response = await this.spotifyService.getQueue(establecimientoId).toPromise();
      if (response?.success && response.queue) {
        const trackInQueue = response.queue.find((q: any) => q.spotify_id === track.spotify_id);
        if (trackInQueue) {
          // Actualizar el status a playing
          await this.spotifyService.updateQueueStatus(trackInQueue.id, 'playing').toPromise();
          console.log('✅ Canción marcada como PLAYING en BD');
        }
      }
    } catch (error) {
      console.error('Error marcando canción como playing:', error);
    }
  }

}
