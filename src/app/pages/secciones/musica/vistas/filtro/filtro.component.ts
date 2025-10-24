import { Component, Input, Output, EventEmitter, AfterViewInit, Inject, PLATFORM_ID, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiltrosService, Filtro } from '../../../../../services/filtros.service';
import { EstablecimientosService } from '../../../../../services/establecimientos.service';
import { ConfiguracionService } from '../../../../../services/configuracion.service';
import { Subscription } from 'rxjs';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-filtro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filtro.component.html',
  styleUrl: './filtro.component.scss'
})
export class FiltroComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input() categoryName: string | null = null;
  @Output() backToCategories = new EventEmitter<void>();

  menuAbierto: {song: number | null, genre: number | null, artist: number | null} = {song: null, genre: null, artist: null};
  userSongLimit: number = 0;
  playLimit: string = 'sin_limite'; // '1_hora', '2_horas', 'sin_limite'
  showConfirmModal: boolean = false;
  establecimientoId: number | null = null;
  loading = true;
  private filtrosSubscription?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private filtrosService: FiltrosService,
    private estService: EstablecimientosService,
    private configuracionService: ConfiguracionService
  ) {}

  async ngOnInit() {
    try {
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        await this.loadFiltros();
        await this.loadConfiguracion();
        
        // Suscribirse a cambios en los filtros
        this.subscribeToFiltrosChanges();
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadConfiguracion() {
    if (!this.establecimientoId) return;
    
    try {
      const response = await this.configuracionService.getConfiguracion(this.establecimientoId).toPromise();
      if (response?.success && response.configuracion) {
        this.playLimit = response.configuracion.limiteReproduccionCancion || 'sin_limite';
        this.userSongLimit = response.configuracion.limitePeticionesUsuarioHora || 0;
        console.log('Configuración cargada:', response.configuracion);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  }

  async savePlayLimit() {
    if (!this.establecimientoId) return;
    
    try {
      const response = await this.configuracionService.updateConfiguracion(
        this.establecimientoId,
        this.playLimit as '1_hora' | '2_horas' | 'sin_limite'
      ).toPromise();
      
      if (response?.success) {
        console.log('Límite de reproducción actualizado');
      }
    } catch (error) {
      console.error('Error actualizando límite de reproducción:', error);
      alert('Error al actualizar la configuración');
    }
  }

  async saveUserSongLimit() {
    if (!this.establecimientoId) return;
    
    try {
      const response = await this.configuracionService.updateConfiguracion(
        this.establecimientoId,
        undefined,
        this.userSongLimit
      ).toPromise();
      
      if (response?.success) {
        console.log('Límite de peticiones por usuario actualizado');
      }
    } catch (error) {
      console.error('Error actualizando límite de peticiones:', error);
      alert('Error al actualizar la configuración');
    }
  }

  subscribeToFiltrosChanges() {
    // Suscribirse al observable de filtros para actualizaciones automáticas
    this.filtrosSubscription = this.filtrosService.filtros$.subscribe((filtros: Filtro[]) => {
      console.log('Filtros actualizados automáticamente:', filtros);
      
      // Separar filtros por tipo
      this.songs = filtros
        .filter(f => f.tipo === 'cancion')
        .map(f => ({ 
          id: f.id_filtro,
          title: f.nombre_display.split(' - ')[0] || f.nombre_display, 
          artist: f.nombre_display.split(' - ')[1] || '',
          imageUrl: f.imagen_url
        }));
      
      this.genres = filtros
        .filter(f => f.tipo === 'genero')
        .map(f => ({ id: f.id_filtro, name: f.nombre_display }));
      
      this.artists = filtros
        .filter(f => f.tipo === 'artista')
        .map(f => ({ 
          id: f.id_filtro, 
          name: f.nombre_display,
          imageUrl: f.imagen_url
        }));
    });
  }

  ngOnDestroy() {
    // Limpiar la suscripción al destruir el componente
    if (this.filtrosSubscription) {
      this.filtrosSubscription.unsubscribe();
    }
  }

  async loadFiltros() {
    if (!this.establecimientoId) return;
    
    try {
      const response = await this.filtrosService.getFiltros(this.establecimientoId).toPromise();
      // No necesitamos procesar aquí porque la suscripción lo hará automáticamente
    } catch (error) {
      console.error('Error cargando filtros:', error);
    }
  }

  @HostListener('document:click', ['$event']) onDocumentClick(event: Event) {
    if (this.menuAbierto.song !== null || this.menuAbierto.genre !== null || this.menuAbierto.artist !== null) {
      const clickedElement = event.target as HTMLElement;
      const menuButton = clickedElement.closest('.mas');
      const menuFlotante = clickedElement.closest('.menu-flotante');

      if (!menuButton && !menuFlotante) {
        this.menuAbierto = {song: null, genre: null, artist: null};
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (!scroller) {
          console.warn("Scroller element not found for animations in FiltroComponent.");
          return;
        }

        gsap.utils.toArray(".filtro-grid .item").forEach((element: any) => {
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

  incrementUserSongLimit() {
    this.userSongLimit++;
  }

  decrementUserSongLimit() {
    if (this.userSongLimit > 0) {
      this.userSongLimit--;
    }
  }

  songs: { id: number, title: string, artist: string, imageUrl?: string }[] = [];
  genres: { id: number, name: string }[] = [];
  artists: { id: number, name: string, imageUrl?: string }[] = [];

  goBack() {
    this.backToCategories.emit();
  }

  abrirMenu(index: number, event: Event, type: 'song' | 'genre' | 'artist') {
    event.stopPropagation();
    // Close other menus if open
    for (const key in this.menuAbierto) {
      if (key !== type) {
        (this.menuAbierto as any)[key] = null;
      }
    }
    (this.menuAbierto as any)[type] = (this.menuAbierto as any)[type] === index ? null : index;
  }

  async eliminarItem(index: number, type: 'cancion' | 'genero' | 'artista') {
    let filtroId: number | undefined;
    
    if (type === 'cancion') {
      filtroId = this.songs[index]?.id;
    } else if (type === 'genero') {
      filtroId = this.genres[index]?.id;
    } else if (type === 'artista') {
      filtroId = this.artists[index]?.id;
    }

    if (!filtroId) return;

    try {
      const response = await this.filtrosService.deleteFiltro(filtroId).toPromise();
      if (response?.success) {
        console.log('Filtro eliminado exitosamente');
        // La suscripción se encargará de actualizar la lista automáticamente
      }
    } catch (error) {
      console.error('Error eliminando filtro:', error);
      alert('Error al eliminar el filtro');
    }
    
    this.menuAbierto = {song: null, genre: null, artist: null};
  }

  clearAllFilters() {
    this.showConfirmModal = true;
  }

  async confirmClearFilters() {
    try {
      // Obtener los filtros actuales antes de empezar a eliminar
      const allFilters = [...this.songs, ...this.genres, ...this.artists];
      
      // Eliminar todos los filtros si existen
      if (allFilters.length > 0) {
        for (const filter of allFilters) {
          await this.filtrosService.deleteFiltro(filter.id).toPromise();
        }
      }
      
      // Restablecer límites a valores por defecto
      this.playLimit = 'sin_limite';
      this.userSongLimit = 0;
      
      // Guardar la configuración restablecida en el backend
      if (this.establecimientoId) {
        await this.configuracionService.updateConfiguracion(
          this.establecimientoId,
          'sin_limite',
          0
        ).toPromise();
      }
      
      this.menuAbierto = {song: null, genre: null, artist: null};
      
      // alert('Todos los filtros y límites han sido restablecidos');
      // La suscripción se encargará de limpiar los arrays automáticamente
    } catch (error) {
      console.error('Error eliminando filtros:', error);
      alert('Error al eliminar los filtros');
    } finally {
      this.showConfirmModal = false;
    }
  }

  cancelClearFilters() {
    this.showConfirmModal = false; // Close modal without clearing
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
