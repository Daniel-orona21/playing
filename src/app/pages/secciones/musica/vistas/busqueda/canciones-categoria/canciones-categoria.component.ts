import { Component, Input, Output, EventEmitter, AfterViewInit, Inject, PLATFORM_ID, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpotifyService } from '../../../../../../services/spotify.service';
import { SpotifyTrack } from '../../../../../../models/musica.interfaces';
import { EstablecimientosService } from '../../../../../../services/establecimientos.service';
import { PlaybackService } from '../../../../../../services/playback.service';
import { AuthService } from '../../../../../../services/auth.service';
import { QueueManagerService } from '../../../../../../services/queue-manager.service';
import { FiltrosService } from '../../../../../../services/filtros.service';
import { Subscription } from 'rxjs';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-canciones-categoria',
  standalone: true,
  imports: [CommonModule],
  providers: [SpotifyService, EstablecimientosService],
  templateUrl: './canciones-categoria.component.html',
  styleUrl: './canciones-categoria.component.scss'
})
export class CancionesCategoriaComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() categoryName: string | null = null;
  @Output() backToCategories = new EventEmitter<void>();
  bloqueado = false;
  songs: SpotifyTrack[] = [];
  loading = true;
  menuAbierto: number | null = null;
  establecimientoId: number | null = null;
  menuPosition = { top: 0, left: 0 }; // Posición del menú flotante
  private filtrosSubscription?: Subscription;
  private readonly PREF_OMITIR_MODAL = 'playing.omitirConfirmacionGenero';
  omitirConfirmacionGenero = false;
  mostrarModalGenero = false;
  procesandoReproduccionGenero = false;
  errorReproduccionGenero: string | null = null;
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private spotifyService: SpotifyService,
    private estService: EstablecimientosService,
    private playbackService: PlaybackService,
    private authService: AuthService,
    private queueManager: QueueManagerService,
    private filtrosService: FiltrosService
  ) {}
  
  async ngOnInit() {
    try {
      this.cargarPreferenciaModalGenero();

      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('Establecimiento ID obtenido:', this.establecimientoId);
        
        // Cargar filtros
        await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
        
        // Verificar si el género está bloqueado inicialmente
        if (this.categoryName) {
          this.bloqueado = this.filtrosService.isGeneroBlocked(this.categoryName.toLowerCase());
        }
        
        // Suscribirse a cambios en filtros para actualizar el estado en tiempo real
        this.subscribeToFiltrosChanges();
        
        // Inicializar el reproductor de Spotify
        await this.initializePlayback();
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento:', error);
    }

    if (this.categoryName && this.establecimientoId) {
      await this.loadSongsByGenre();
    }
  }

  subscribeToFiltrosChanges() {
    this.filtrosSubscription = this.filtrosService.filtros$.subscribe(() => {
      // Actualizar el estado de bloqueado cuando cambien los filtros
      if (this.categoryName) {
        this.bloqueado = this.filtrosService.isGeneroBlocked(this.categoryName.toLowerCase());
        console.log(`Estado de bloqueo actualizado para género ${this.categoryName}: ${this.bloqueado}`);
      }
    });
  }

  ngOnDestroy() {
    // Limpiar la suscripción al destruir el componente
    if (this.filtrosSubscription) {
      this.filtrosSubscription.unsubscribe();
    }
  }

  isCancionBlocked(spotifyId: string): boolean {
    return this.filtrosService.isCancionBlocked(spotifyId);
  }

  async initializePlayback() {
    if (!this.establecimientoId) {
      console.error('❌ No establecimiento ID available for playback initialization');
      return;
    }

    try {
      // Verificar si ya está inicializado
      let isInitialized = false;
      this.playbackService.isInitialized$.subscribe(value => {
        isInitialized = value;
      }).unsubscribe();
      
      if (!isInitialized) {
        console.log('🔄 Initializing playback service for establishment:', this.establecimientoId);
        await this.playbackService.initialize(this.establecimientoId);
        console.log('✅ Playback service initialized successfully!');
        
        // Inicializar el gestor de cola
        console.log('🔄 Initializing queue manager...');
        await this.queueManager.initialize(this.establecimientoId);
        console.log('✅ Queue manager initialized successfully!');
      }
    } catch (error) {
      console.error('❌ Error initializing playback:', error);
    }
  }
  
  @HostListener('document:click', ['$event']) onDocumentClick(event: Event) {
    if (this.menuAbierto !== null) {
      const clickedElement = event.target as HTMLElement;
      const menuButton = clickedElement.closest('.mas');
      const menuFlotante = clickedElement.closest('.menu-flotante');
      
      if (!menuButton && !menuFlotante) {
        this.menuAbierto = null;
      }
    }
  }
  
  async toggleBloqueo() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user || !this.establecimientoId || !this.categoryName) {
        alert('Error: Usuario, establecimiento o categoría no disponible');
        return;
      }

      if (this.bloqueado) {
        // Desbloquear: buscar el filtro y eliminarlo
        const filtro = this.filtrosService.getFiltroByTipoAndValor('genero', this.categoryName.toLowerCase());
        
        if (filtro) {
          console.log('Desbloqueando género:', this.categoryName);
          
          const response = await this.filtrosService.deleteFiltro(filtro.id_filtro).toPromise();
          
          if (response?.success) {
            this.bloqueado = false;
            // alert(`Género "${this.categoryName}" desbloqueado exitosamente.`);
          }
        } else {
          // Si no se encuentra el filtro, actualizar el estado
          this.bloqueado = false;
        }
      } else {
        // Bloquear: crear nuevo filtro
        console.log('Bloqueando género:', this.categoryName);
        
        const response = await this.filtrosService.addFiltro({
          establecimientoId: this.establecimientoId,
          tipo: 'genero',
          valor: this.categoryName.toLowerCase(),
          nombreDisplay: this.categoryName,
          usuarioId: user.id
        }).toPromise();

        if (response?.success) {
          this.bloqueado = true;
          // alert(`Género "${this.categoryName}" bloqueado exitosamente.`);
        }
      }
    } catch (error: any) {
      console.error('Error en toggle de bloqueo de género:', error);
      if (error.status === 409) {
        alert('Este género ya está bloqueado');
        this.bloqueado = true;
        // Actualizar filtros por si acaso
        if (this.establecimientoId) {
          await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
        }
      } else {
        alert('Error al cambiar el estado del bloqueo del género');
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (!scroller) {
          console.warn("Scroller element not found for animations in CancionesCategoriaComponent.");
          return;
        }

        gsap.utils.toArray(".songs-grid .cancion").forEach((element: any) => {
          if (!this._isElementInScrollerViewport(element, scroller as HTMLElement)) {
            gsap.set(element, { opacity: 0, scale: 0.65 });
          }
          gsap.to(element,
            {
              opacity: 1,
              scale: 1,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: {
                trigger: element,
                scroller: scroller,
                start: "top 100%",
                toggleActions: "play none none reverse",
              }
            }
          );
        });
        ScrollTrigger.refresh();
      }, 0);
    }
  }

  async loadSongsByGenre() {
    try {
      this.loading = true;
      if (!this.establecimientoId) {
        console.error('No establecimiento ID available');
        return;
      }
      console.log('Loading songs for genre:', this.categoryName, 'establecimiento:', this.establecimientoId);
      const response = await this.spotifyService.getTracksByGenre(this.categoryName!.toLowerCase(), this.establecimientoId).toPromise();
      if (response?.success) {
        this.songs = response.tracks;
        console.log('Songs loaded:', this.songs.length);
      }
    } catch (error) {
      console.error('Error loading songs by genre:', error);
    } finally {
      this.loading = false;
    }
  }

  private cargarPreferenciaModalGenero() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.PREF_OMITIR_MODAL);
      this.omitirConfirmacionGenero = stored === 'true';
    }
  }

  onChangeOmitirConfirmacionGenero(omit: boolean) {
    this.omitirConfirmacionGenero = omit;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.PREF_OMITIR_MODAL, String(omit));
    }
  }

  abrirModalReproduccionGenero() {
    if (this.loading) {
      return;
    }

    const hayCancionesDisponibles = this.songs.some(song => !this.isCancionBlocked(song.spotify_id));
    if (!hayCancionesDisponibles) {
      alert('No hay canciones disponibles para este género.');
      return;
    }

    if (this.omitirConfirmacionGenero) {
      this.reproducirGeneroCompleto();
      return;
    }

    this.errorReproduccionGenero = null;
    this.mostrarModalGenero = true;
  }

  cerrarModalGenero() {
    if (this.procesandoReproduccionGenero) {
      return;
    }
    this.mostrarModalGenero = false;
    this.errorReproduccionGenero = null;
  }

  async confirmarReproduccionGenero() {
    if (this.procesandoReproduccionGenero) {
      return;
    }
    await this.reproducirGeneroCompleto();
  }

  private async reproducirGeneroCompleto() {
    if (!this.establecimientoId || !this.categoryName) {
      this.errorReproduccionGenero = 'Establecimiento o género no disponible.';
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorReproduccionGenero = 'Usuario no autenticado.';
      return;
    }

    const cancionesDisponibles = this.songs.filter(song => !this.isCancionBlocked(song.spotify_id));
    if (!cancionesDisponibles.length) {
      this.errorReproduccionGenero = 'No hay canciones disponibles para este género.';
      return;
    }

    this.procesandoReproduccionGenero = true;
    this.errorReproduccionGenero = null;

    try {
      const response = await this.spotifyService.replaceQueueWithGenre(
        cancionesDisponibles,
        this.establecimientoId,
        user.id,
        this.categoryName
      ).toPromise();

      if (!response?.success || !response.currentTrack || !response.playingQueueId) {
        throw new Error('No se pudo preparar la reproducción del género');
      }

      const track: SpotifyTrack = {
        spotify_id: response.currentTrack.spotify_id,
        titulo: response.currentTrack.titulo,
        artista: response.currentTrack.artista,
        album: response.currentTrack.album,
        duracion: response.currentTrack.duracion,
        imagen_url: response.currentTrack.imagen_url,
        genero: response.currentTrack.genero,
        preview_url: response.currentTrack.preview_url
      };

      window.dispatchEvent(new CustomEvent('trackChanging', { detail: { spotifyId: track.spotify_id } }));

      this.queueManager.setCurrentQueueItem(response.playingQueueId);
      await this.playbackService.playTrack(track.spotify_id, track);

      window.dispatchEvent(new CustomEvent('queueUpdated'));
      this.mostrarModalGenero = false;
    } catch (error: any) {
      console.error('Error reproduciendo género completo:', error);
      this.errorReproduccionGenero = error?.error?.error || error?.message || 'Error al reemplazar la fila de reproducción';
      window.dispatchEvent(new CustomEvent('trackChangeFailed'));
    } finally {
      this.procesandoReproduccionGenero = false;
    }
  }

  goBack() {
    this.backToCategories.emit();
  }

  abrirMenu(index: number, event: Event) {
    event.stopPropagation(); // Prevent the click from propagating to the song container
    
    if (this.menuAbierto === index) {
      this.menuAbierto = null;
    } else {
      this.menuAbierto = index;
      
      // Calcular posición del botón
      const button = event.target as HTMLElement;
      const rect = button.getBoundingClientRect();
      
      // Posicionar el menú justo debajo del botón
      this.menuPosition = {
        top: rect.bottom + 5, // 5px debajo del botón
        left: rect.right - 200 // Alineado a la derecha (asumiendo ancho de menú ~200px)
      };
    }
  }

  eliminarCancion(index: number) {
    console.log('Eliminar canción:', index);
    this.menuAbierto = null; // Close the menu after action
  }

  async bloquearCancion(song: SpotifyTrack) {
    try {
      const user = this.authService.getCurrentUser();
      if (!user || !this.establecimientoId) {
        alert('Error: Usuario o establecimiento no disponible');
        return;
      }

      console.log('Bloqueando canción:', song.titulo);
      
      const response = await this.filtrosService.addFiltro({
        establecimientoId: this.establecimientoId,
        tipo: 'cancion',
        valor: song.spotify_id,
        nombreDisplay: `${song.titulo} - ${song.artista}`,
        imagenUrl: song.imagen_url ?? undefined,
        usuarioId: user.id
      }).toPromise();

      if (response?.success) {
        // alert(`Canción "${song.titulo}" bloqueada exitosamente`);
        this.menuAbierto = null;
        
        // Actualizar los filtros locales
        await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
      }
    } catch (error: any) {
      console.error('Error bloqueando canción:', error);
      if (error.status === 409) {
        alert('Esta canción ya está bloqueada');
        this.menuAbierto = null;
        // Actualizar filtros por si acaso
        if (this.establecimientoId) {
          await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
        }
      } else {
        alert('Error al bloquear la canción');
      }
    }
  }

  async reproducirCancion(song: SpotifyTrack, event: Event) {
    event.stopPropagation();
    
    try {
      const currentState = this.playbackService.getCurrentState();
      const isSameTrack = currentState.currentTrack?.spotify_id === song.spotify_id;
      
      if (isSameTrack) {
        await this.playbackService.seek(0);
        if (!currentState.isPlaying) {
          await this.playbackService.resume();
        }
        return;
      }
      
      window.dispatchEvent(new CustomEvent('trackChanging', { detail: { spotifyId: song.spotify_id } }));
      
      const response = await this.agregarALaColaYReproducir(song);
      
      if (!response) {
        window.dispatchEvent(new CustomEvent('trackChangeFailed'));
      }
    } catch (error) {
      console.error('Error playing song:', error);
      window.dispatchEvent(new CustomEvent('trackChangeFailed'));
      alert('Error al reproducir la canción. Asegúrate de que Spotify esté conectado.');
    }
  }

  async agregarALaColaYReproducir(song: SpotifyTrack): Promise<boolean> {
    try {
      const user = this.authService.getCurrentUser();
      if (!user || !this.establecimientoId) {
        console.error('No user or establecimiento available');
        return false;
      }

      console.log('Adding song to queue and playing:', song.titulo);
      
      // ✅ Usar el nuevo endpoint que agrega al principio y reproduce inmediatamente
      const response = await this.spotifyService.addToQueueAndPlayNow(
        song,
        this.establecimientoId,
        user.id
      ).toPromise();

      if (response?.success && response.queueId) {
        console.log('Song added at position 1 and playing with ID:', response.queueId);
        
        // Establecer el ID actual en el queue manager
        this.queueManager.setCurrentQueueItem(response.queueId);
        
        // Reproducir la canción
        await this.playbackService.playTrack(song.spotify_id, song);
        
        // Emitir evento
        window.dispatchEvent(new CustomEvent('queueUpdated'));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error adding song to queue and playing:', error);
      return false;
    }
  }

  async agregarALaCola(song: SpotifyTrack, showAlert: boolean = true) {
    try {
      const user = this.authService.getCurrentUser();
      if (!user || !this.establecimientoId) {
        console.error('No user or establecimiento available');
        if (showAlert) {
          alert('Error: Usuario o establecimiento no disponible');
        }
        return;
      }

      console.log('Adding song to queue:', song.titulo);
      
      const response = await this.spotifyService.addToQueue(
        song,
        this.establecimientoId,
        user.id
      ).toPromise();

      if (response?.success) {
        console.log('Song added to queue successfully at position', response.position);
        if (showAlert) {
          // alert(`"${song.titulo}" agregada a la cola en posición ${response.position}`);
        }
        
        // Emitir evento personalizado para que otros componentes sepan que se agregó una canción
        window.dispatchEvent(new CustomEvent('queueUpdated'));
      } else {
        throw new Error('Failed to add song to queue');
      }
    } catch (error) {
      console.error('Error adding song to queue:', error);
      if (showAlert) {
        alert('Error al agregar la canción a la cola');
      }
    }
  }

  private _isElementInScrollerViewport(element: HTMLElement, scroller: Element, threshold: number = 0): boolean {
    const scrollerRect = scroller.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    return (
      elementRect.top >= scrollerRect.top - (scrollerRect.height * threshold) &&
      elementRect.left >= scrollerRect.left - (scrollerRect.width * threshold) &&
      elementRect.bottom <= scrollerRect.bottom + (scrollerRect.height * threshold) &&
      elementRect.right <= scrollerRect.right + (scrollerRect.width * threshold)
    );
  }
}