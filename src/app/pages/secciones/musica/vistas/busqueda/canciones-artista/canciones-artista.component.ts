import { Component, Input, Output, EventEmitter, AfterViewInit, Inject, PLATFORM_ID, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpotifyService } from '../../../../../../services/spotify.service';
import { SpotifyTrack, SpotifyArtist } from '../../../../../../models/musica.interfaces';
import { EstablecimientosService } from '../../../../../../services/establecimientos.service';
import { PlaybackService } from '../../../../../../services/playback.service';
import { AuthService } from '../../../../../../services/auth.service';
import { QueueManagerService } from '../../../../../../services/queue-manager.service';
import { FiltrosService } from '../../../../../../services/filtros.service';
import { Subscription } from 'rxjs';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-canciones-artista',
  standalone: true,
  imports: [CommonModule],
  providers: [SpotifyService, EstablecimientosService],
  templateUrl: './canciones-artista.component.html',
  styleUrl: './canciones-artista.component.scss'
})
export class CancionesArtistaComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() artist: SpotifyArtist | null = null;
  @Output() backToResults = new EventEmitter<void>();
  bloqueado = false;
  songs: SpotifyTrack[] = [];
  loading = true;
  menuAbierto: number | null = null;
  establecimientoId: number | null = null;
  menuPosition = { top: 0, left: 0 }; // Posición del menú flotante
  private filtrosSubscription?: Subscription;
  
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
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('Establecimiento ID obtenido:', this.establecimientoId);
        
        // Cargar filtros
        await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
        
        // Verificar si el artista está bloqueado inicialmente
        if (this.artist) {
          this.bloqueado = this.filtrosService.isArtistaBlocked(this.artist.nombre);
        }
        
        // Suscribirse a cambios en filtros para actualizar el estado en tiempo real
        this.subscribeToFiltrosChanges();
        
        // Inicializar el reproductor de Spotify
        await this.initializePlayback();
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento:', error);
    }

    if (this.artist && this.establecimientoId) {
      await this.loadSongsByArtist();
    }
  }

  subscribeToFiltrosChanges() {
    this.filtrosSubscription = this.filtrosService.filtros$.subscribe(() => {
      // Actualizar el estado de bloqueado cuando cambien los filtros
      if (this.artist) {
        this.bloqueado = this.filtrosService.isArtistaBlocked(this.artist.nombre);
        console.log(`Estado de bloqueo actualizado para ${this.artist.nombre}: ${this.bloqueado}`);
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
      if (!user || !this.establecimientoId || !this.artist) {
        alert('Error: Usuario, establecimiento o artista no disponible');
        return;
      }

      if (this.bloqueado) {
        // Desbloquear: buscar el filtro y eliminarlo
        const filtro = this.filtrosService.getFiltroByTipoAndValor('artista', this.artist.nombre);
        
        if (filtro) {
          console.log('Desbloqueando artista:', this.artist.nombre);
          
          const response = await this.filtrosService.deleteFiltro(filtro.id_filtro).toPromise();
          
          if (response?.success) {
            this.bloqueado = false;
            // alert(`Artista "${this.artist.nombre}" desbloqueado exitosamente.`);
          }
        } else {
          // Si no se encuentra el filtro, actualizar el estado
          this.bloqueado = false;
        }
      } else {
        // Bloquear: crear nuevo filtro
        console.log('Bloqueando artista:', this.artist.nombre);
        
        const response = await this.filtrosService.addFiltro({
          establecimientoId: this.establecimientoId,
          tipo: 'artista',
          valor: this.artist.nombre,
          nombreDisplay: this.artist.nombre,
          imagenUrl: this.artist.imagen_url ?? undefined,
          usuarioId: user.id
        }).toPromise();

        if (response?.success) {
          this.bloqueado = true;
          // alert(`Artista "${this.artist.nombre}" bloqueado exitosamente.`);
        }
      }
    } catch (error: any) {
      console.error('Error en toggle de bloqueo de artista:', error);
      if (error.status === 409) {
        alert('Este artista ya está bloqueado');
        this.bloqueado = true;
        // Actualizar filtros por si acaso
        if (this.establecimientoId) {
          await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
        }
      } else {
        alert('Error al cambiar el estado del bloqueo del artista');
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (!scroller) {
          console.warn("Scroller element not found for animations in CancionesArtistaComponent.");
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

  async loadSongsByArtist() {
    try {
      this.loading = true;
      if (!this.establecimientoId || !this.artist) {
        console.error('No establecimiento ID or artist available');
        return;
      }
      console.log('Loading songs for artist:', this.artist.nombre, 'establecimiento:', this.establecimientoId);
      const response = await this.spotifyService.getTracksByArtist(this.artist.spotify_id, this.establecimientoId).toPromise();
      if (response?.success) {
        this.songs = response.tracks;
        console.log('Songs loaded:', this.songs.length);
      }
    } catch (error) {
      console.error('Error loading songs by artist:', error);
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    this.backToResults.emit();
  }

  abrirMenu(index: number, event: Event) {
    event.stopPropagation();
    
    if (this.menuAbierto === index) {
      this.menuAbierto = null;
    } else {
      this.menuAbierto = index;
      
      // Calcular posición del botón
      const button = event.target as HTMLElement;
      const rect = button.getBoundingClientRect();
      
      // Posicionar el menú justo debajo del botón
      this.menuPosition = {
        top: rect.bottom + 5,
        left: rect.right - 200
      };
    }
  }

  eliminarCancion(index: number) {
    console.log('Eliminar canción:', index);
    this.menuAbierto = null;
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
      console.log('Playing song:', song.titulo);
      
      const response = await this.agregarALaColaYReproducir(song);
      
      if (response) {
        console.log('Song playing successfully');
      }
    } catch (error) {
      console.error('Error playing song:', error);
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
      
      const response = await this.spotifyService.addToQueueAndPlayNow(
        song,
        this.establecimientoId,
        user.id
      ).toPromise();

      if (response?.success && response.queueId) {
        console.log('Song added at position 1 and playing with ID:', response.queueId);
        
        this.queueManager.setCurrentQueueItem(response.queueId);
        
        await this.playbackService.playTrack(song.spotify_id, song);
        
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

