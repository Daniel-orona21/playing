import { Component, HostListener, AfterViewInit, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpotifyService } from '../../../../../services/spotify.service';
import { EstablecimientosService } from '../../../../../services/establecimientos.service';

interface Cancion {
  id: number;
  nombre: string;
  artista: string;
  duracion?: string;
  album?: string;
  year?: number;
  imagen_url?: string;
  usuario_id?: number;
  usuario_nombre?: string;
}

@Component({
  selector: 'app-lista',
  imports: [CommonModule],
  templateUrl: './lista.component.html',
  styleUrl: './lista.component.scss'
})
export class ListaComponent implements OnInit, AfterViewInit{

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);

    if (isPlatformBrowser(this.platformId)) {
      this._setupContinuacionAnimations();
      this._setupHistorialAnimations();
    }
  }

  private _setupContinuacionAnimations(): void {
    const scroller = document.querySelector(".side.continuacion .canciones");
    if (!scroller) return;

    gsap.utils.toArray(".side.continuacion .canciones .cancion").forEach((element: any) => {
      if (!this._isElementInScrollerViewport(element, scroller as HTMLElement)) {
        gsap.set(element, { opacity: 0, y: 0, scale: 0.65 });
      }
      gsap.to(element,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            scroller: scroller,
            start: "top 95%",
            toggleActions: "play none none reverse",
          }
        }
      );
    });
  }

  private _setupHistorialAnimations(): void {
    const scroller = document.querySelector(".side.historial .canciones");
    if (!scroller) return;

    gsap.utils.toArray(".side.historial .canciones .cancion").forEach((element: any) => {
      if (!this._isElementInScrollerViewport(element, scroller as HTMLElement)) {
        gsap.set(element, { opacity: 0, y: 0, scale: 0.65 });
      }
      gsap.to(element,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            scroller: scroller,
            start: "top 95%",
            toggleActions: "play none none reverse",
          }
        }
      );
    });
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

  aContinuacion: any[] = [];
  establecimientoId: number | null = null;
  loading = true;

  historial: Cancion[] = [];

  menuAbierto: number | null = null;
  isDeleting = false; // ✅ Flag para evitar recargas durante eliminación
  deletingIds: Set<number> = new Set(); // ✅ IDs de canciones que se están eliminando

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private spotifyService: SpotifyService,
    private estService: EstablecimientosService
  ) {}

  async ngOnInit() {
    // Obtener el establecimiento actual
    try {
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('Establecimiento ID obtenido en lista:', this.establecimientoId);
        
        // Cargar la cola inicial
        await this.cargarCola();
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento en lista:', error);
    } finally {
      this.loading = false;
    }

    // Escuchar eventos de canción reproducida para recargar la cola
    window.addEventListener('spotifyTrackPlayed', () => {
      if (!this.isDeleting) {
        this.cargarCola();
      }
    });

    // Escuchar eventos de actualización de cola
    window.addEventListener('queueUpdated', () => {
      if (!this.isDeleting) {
        this.cargarCola();
      }
    });
  }

  async cargarCola() {
    if (!this.establecimientoId) {
      console.error('No establecimiento ID available');
      return;
    }

    try {
      console.log('Loading queue for establecimiento:', this.establecimientoId);
      const response = await this.spotifyService.getQueue(this.establecimientoId).toPromise();
      
      if (response?.success) {
        this.aContinuacion = response.queue.map((item: any) => ({
          id: item.id,
          cancion_id: item.cancion_id,
          spotify_id: item.spotify_id,
          titulo: item.titulo,
          artista: item.artista,
          album: item.album,
          duracion: item.duracion,
          imagen_url: item.imagen_url,
          genero: item.genero,
          preview_url: item.preview_url,
          posicion: item.posicion,
          status: item.status,
          usuario_nombre: item.usuario_nombre,
          agregada_en: item.agregada_en
        }));
        console.log('Queue loaded:', this.aContinuacion.length, 'songs');
      }

      // Cargar el historial también
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  }

  async cargarHistorial() {
    if (!this.establecimientoId) {
      return;
    }

    try {
      console.log('Loading history for establecimiento:', this.establecimientoId);
      const response = await this.spotifyService.getHistory(this.establecimientoId, 10).toPromise();
      
      if (response?.success) {
        this.historial = response.history.map((item: any) => ({
          id: item.id_historial,
          nombre: item.titulo,
          artista: item.artista,
          duracion: this.formatDuration(item.duracion),
          album: item.album,
          imagen_url: item.imagen_url,
          usuario_id: item.usuario_id,
          usuario_nombre: item.usuario_nombre
        }));
        console.log('History loaded:', this.historial.length, 'songs');
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  async eliminarCancion(index: number) {
    const cancion = this.aContinuacion[index];
    if (!cancion) {
      console.error('No song found at index:', index);
      return;
    }

    // Verificar si ya se está eliminando esta canción
    if (this.deletingIds.has(cancion.id)) {
      console.log('Esta canción ya se está eliminando');
      return;
    }

    console.log('🗑️ Starting deletion for song:', cancion.id, cancion.titulo, 'at index:', index);

    try {
      // 1. Marcar como eliminando para bloquear event listeners
      this.isDeleting = true;
      this.deletingIds.add(cancion.id);
      
      // 2. Eliminar de la base de datos PRIMERO
      console.log('🗑️ Deleting from database:', cancion.id);
      const response = await this.spotifyService.removeFromQueue(cancion.id).toPromise();
      
      if (!response?.success) {
        throw new Error('Failed to remove song from queue');
      }
      
      console.log('✅ Deleted from database');
      
      // 3. Encontrar el elemento DOM correcto por su ID (no por index)
      const cancionElement = document.querySelector(`.side.continuacion .canciones .cancion[data-song-id="${cancion.id}"]`) as HTMLElement;
      console.log('🎯 Found element to animate:', cancionElement ? 'YES' : 'NO');
      
      if (cancionElement) {
        // 4. Animar el elemento
        await new Promise<void>((resolve) => {
          gsap.to(cancionElement, {
            opacity: 0,
            height: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingTop: 0,
            paddingBottom: 0,
            duration: 0.3,
            ease: "power1.out",
            onComplete: () => {
              console.log('✅ Animation completed');
              resolve();
            }
          });
        });
      }
      
      // 5. Eliminar del array local después de la animación
      const indexToRemove = this.aContinuacion.findIndex(item => item.id === cancion.id);
      if (indexToRemove !== -1) {
        this.aContinuacion.splice(indexToRemove, 1);
        console.log('✅ Removed from local array');
      }
      
      this.menuAbierto = null;
      ScrollTrigger.refresh();
      
    } catch (error) {
      console.error('❌ Error removing song from queue:', error);
      alert('Error al eliminar la canción de la cola');
      // Si hay error, recargar para tener el estado correcto
      await this.cargarCola();
    } finally {
      // SIEMPRE limpiar al final
      this.deletingIds.delete(cancion.id);
      this.isDeleting = false;
      console.log('🔓 Deletion process finished');
    }
  }

  abrirMenu(index: number, event: Event) {
    event.stopPropagation();
    this.menuAbierto = this.menuAbierto === index ? null : index;
  }

  cerrarMenu() {
    this.menuAbierto = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.menuAbierto !== null) {
      this.cerrarMenu();
    }
  }
}
