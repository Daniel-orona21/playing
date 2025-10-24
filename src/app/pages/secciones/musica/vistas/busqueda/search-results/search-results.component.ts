import { Component, Input, OnInit, AfterViewInit, OnChanges, SimpleChanges, Inject, PLATFORM_ID, HostListener } from '@angular/core';
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
import { CancionesArtistaComponent } from '../canciones-artista/canciones-artista.component';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, CancionesArtistaComponent],
  providers: [SpotifyService, EstablecimientosService],
  templateUrl: './search-results.component.html',
  styleUrl: './search-results.component.scss'
})
export class SearchResultsComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() searchTerm: string = '';
  songs: SpotifyTrack[] = [];
  artists: SpotifyArtist[] = [];
  selectedArtist: SpotifyArtist | null = null;
  loading = true;
  menuAbierto: number | null = null;
  menuArtistaAbierto: number | null = null;
  establecimientoId: number | null = null;
  menuPosition = { top: 0, left: 0 }; // Posición del menú flotante
  menuArtistaPosition = { top: 0, left: 0 }; // Posición del menú flotante de artistas

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
    // Obtener el establecimiento actual
    try {
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('Establecimiento ID obtenido:', this.establecimientoId);
        
        // Cargar filtros
        await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
        
        // Inicializar el reproductor de Spotify
        await this.initializePlayback();
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento:', error);
    }

    if (this.searchTerm && this.establecimientoId) {
      await this.searchSongs();
    }
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

  async ngOnChanges(changes: SimpleChanges) {
    // Este método se ejecutará cuando cambie el searchTerm
    if (changes['searchTerm'] && this.searchTerm && this.establecimientoId) {
      console.log('Search term changed, searching for:', this.searchTerm);
      await this.searchSongs();
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (!scroller) {
          console.warn("Scroller element not found for animations in SearchResultsComponent.");
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

  @HostListener('document:click', ['$event']) onDocumentClick(event: Event) {
    if (this.menuAbierto !== null || this.menuArtistaAbierto !== null) {
      const clickedElement = event.target as HTMLElement;
      const menuButton = clickedElement.closest('.mas');
      const menuFlotante = clickedElement.closest('.menu-flotante');
      
      if (!menuButton && !menuFlotante) {
        this.menuAbierto = null;
        this.menuArtistaAbierto = null;
      }
    }
  }

  async searchSongs() {
    try {
      this.loading = true;
      if (!this.establecimientoId) {
        console.error('No establecimiento ID available');
        return;
      }
      console.log('Searching songs and artists for:', this.searchTerm, 'establecimiento:', this.establecimientoId);
      const response = await this.spotifyService.searchTracks(this.searchTerm, this.establecimientoId).toPromise();
      if (response?.success) {
        this.songs = response.tracks;
        this.artists = response.artists || [];
        console.log('Search results loaded:', this.songs.length, 'songs and', this.artists.length, 'artists');
      }
    } catch (error) {
      console.error('Error searching songs:', error);
    } finally {
      this.loading = false;
    }
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
        top: rect.bottom + 5, // 5px debajo del botón
        left: rect.right - 200 // Alineado a la derecha (asumiendo ancho de menú ~200px)
      };
    }
  }

  eliminarCancion(index: number) {
    console.log('Eliminar canción:', index);
    this.menuAbierto = null;
  }

  abrirMenuArtista(index: number, event: Event) {
    event.stopPropagation();
    
    if (this.menuArtistaAbierto === index) {
      this.menuArtistaAbierto = null;
    } else {
      this.menuArtistaAbierto = index;
      
      const button = event.target as HTMLElement;
      const rect = button.getBoundingClientRect();
    
      this.menuArtistaPosition = {
        top: rect.bottom + 5, 
        left: rect.right - 200 
      };
    }
  }

  isArtistaBlocked(artistName: string): boolean {
    return this.filtrosService.isArtistaBlocked(artistName);
  }

  isCancionBlocked(spotifyId: string): boolean {
    return this.filtrosService.isCancionBlocked(spotifyId);
  }

  async bloquearArtista(artist: SpotifyArtist) {
    try {
      const user = this.authService.getCurrentUser();
      if (!user || !this.establecimientoId) {
        alert('Error: Usuario o establecimiento no disponible');
        return;
      }

      console.log('Bloqueando artista:', artist.nombre);
      
      const response = await this.filtrosService.addFiltro({
        establecimientoId: this.establecimientoId,
        tipo: 'artista',
        valor: artist.nombre,
        nombreDisplay: artist.nombre,
        imagenUrl: artist.imagen_url ?? undefined,
        usuarioId: user.id
      }).toPromise();

      if (response?.success) {
        // alert(`Artista "${artist.nombre}" bloqueado exitosamente`);
        this.menuArtistaAbierto = null;
        
        // Actualizar los filtros locales
        await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
      }
    } catch (error: any) {
      console.error('Error bloqueando artista:', error);
      if (error.status === 409) {
        alert('Este artista ya está bloqueado');
        this.menuArtistaAbierto = null;
        // Actualizar filtros por si acaso
        if (this.establecimientoId) {
          await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
        }
      } else {
        alert('Error al bloquear el artista');
      }
    }
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

  selectArtist(artist: SpotifyArtist) {
    this.selectedArtist = artist;
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (scroller) {
          scroller.scrollTop = 0; // Reset scroll position to top when selecting an artist
        }
      }, 0);
    }
  }

  clearArtist() {
    this.selectedArtist = null;
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (scroller) {
          scroller.scrollTop = 0; // Reset scroll position to top when returning to results
        }
      }, 0);
    }
  }

  async reproducirCancion(song: SpotifyTrack, event: Event) {
    event.stopPropagation();
    
    try {
      console.log('Playing song:', song.titulo);
      
      // Primero, agregar la canción a la cola y obtener su ID
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
