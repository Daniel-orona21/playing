import { Component, Input, Output, EventEmitter, AfterViewInit, Inject, PLATFORM_ID, HostListener, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpotifyService } from '../../../../../../services/spotify.service';
import { SpotifyTrack } from '../../../../../../models/musica.interfaces';
import { MusicaConfigService } from '../../../../../../services/musica-config.service';
import { EstablecimientosService } from '../../../../../../services/establecimientos.service';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-canciones-categoria',
  standalone: true,
  imports: [CommonModule],
  providers: [SpotifyService, MusicaConfigService, EstablecimientosService],
  templateUrl: './canciones-categoria.component.html',
  styleUrl: './canciones-categoria.component.scss'
})
export class CancionesCategoriaComponent implements OnInit, AfterViewInit {
  @Input() categoryName: string | null = null;
  @Output() backToCategories = new EventEmitter<void>();
  bloqueado = false;
  songs: SpotifyTrack[] = [];
  loading = true;
  menuAbierto: number | null = null;
  establecimientoId: number | null = null;
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private spotifyService: SpotifyService,
    private musicaConfigService: MusicaConfigService,
    private estService: EstablecimientosService
  ) {}
  
  async ngOnInit() {
    // Obtener el establecimiento actual
    try {
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('Establecimiento ID obtenido:', this.establecimientoId);
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento:', error);
    }

    if (this.categoryName && this.establecimientoId) {
      await this.loadSongsByGenre();
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
  
  toggleBloqueo() {
    this.bloqueado = !this.bloqueado;
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

  async playTrack(track: SpotifyTrack) {
    try {
      if (!this.establecimientoId) {
        console.error('No establecimiento ID available');
        return;
      }
      
      const userId = 1; // Hardcoded for now - TODO: get from auth service
      
      // Reproducir la canción inmediatamente (posición 1 en la cola)
      await this.spotifyService.addToQueueAndPlay(track, userId, this.establecimientoId);
      console.log('✅ Track added to queue and started playing');
    } catch (error) {
      console.error('Error playing track:', error);
    }
  }

  async addToQueue(track: SpotifyTrack) {
    try {
      if (!this.establecimientoId) {
        console.error('No establecimiento ID available');
        return;
      }
      const userId = 1; // Hardcoded for now - TODO: get from auth service
      await this.spotifyService.addToQueue(track, userId, this.establecimientoId).toPromise();
      console.log('Track added to queue');
    } catch (error) {
      console.error('Error adding to queue:', error);
    }
  }

  async blockTrack(track: SpotifyTrack) {
    try {
      if (!this.establecimientoId) {
        console.error('No establecimiento ID available');
        return;
      }
      await this.musicaConfigService.addFilter({
        establecimiento_id: this.establecimientoId,
        tipo: 'cancion',
        spotify_id: track.spotify_id,
        razon: 'Bloqueado por administrador'
      }).toPromise();
      console.log('Track blocked');
    } catch (error) {
      console.error('Error blocking track:', error);
    }
  }

  async blockGenre(genre: string) {
    try {
      if (!this.establecimientoId) {
        console.error('No establecimiento ID available');
        return;
      }
      await this.musicaConfigService.addFilter({
        establecimiento_id: this.establecimientoId,
        tipo: 'genero',
        genero: genre,
        razon: 'Género bloqueado por administrador'
      }).toPromise();
      console.log('Genre blocked');
    } catch (error) {
      console.error('Error blocking genre:', error);
    }
  }

  goBack() {
    this.backToCategories.emit();
  }

  abrirMenu(index: number, event: Event) {
    event.stopPropagation(); // Prevent the click from propagating to the song container
    this.menuAbierto = this.menuAbierto === index ? null : index;
  }

  eliminarCancion(index: number) {
    console.log('Eliminar canción:', index);
    this.menuAbierto = null; // Close the menu after action
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