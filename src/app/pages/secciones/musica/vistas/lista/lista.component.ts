import { Component, HostListener, AfterViewInit, Inject, PLATFORM_ID, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SpotifyService } from '../../../../../services/spotify.service';
import { EstablecimientosService } from '../../../../../services/establecimientos.service';
import { MusicaSocketService } from '../../../../../services/musica-socket.service';

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
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista.component.html',
  styleUrl: './lista.component.scss'
})
export class ListaComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() hidden: boolean = false;
  private animationsInitialized = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Detectar cuando el componente se vuelve visible
    if (changes['hidden'] && !changes['hidden'].currentValue && changes['hidden'].previousValue) {
      // El componente acaba de volverse visible
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this._refreshAnimations();
        }, 100);
      }
    }
  }

  ngAfterViewInit(): void {
    
    gsap.registerPlugin(ScrollTrigger);

    if (isPlatformBrowser(this.platformId)) {
      // Solo configurar animaciones si el componente está visible
      setTimeout(() => {
        if (!this.hidden) {
          this._setupContinuacionAnimations();
          this._setupHistorialAnimations();
          this.animationsInitialized = true;
        }
      }, 100);
    }
  }

  private _refreshAnimations(): void {
    
    console.log('🔄 Refreshing ALL lista animations');
    this._refreshContinuacionAnimations();
    this._refreshHistorialAnimations();
    this.animationsInitialized = true;
  }

  private _refreshContinuacionAnimations(): void {
    console.log('🔄 Refreshing CONTINUACION animations only');
    
    // Matar solo las animaciones de la cola/continuación
    ScrollTrigger.getAll().forEach(st => {
      const trigger = st.trigger as HTMLElement;
      if (trigger && trigger.closest('.side.continuacion')) {
        st.kill();
      }
    });
    
    // Reconfigurar solo las animaciones de continuación
    this._setupContinuacionAnimations();
    
    // Refrescar ScrollTrigger
    ScrollTrigger.refresh();
  }

  private _refreshHistorialAnimations(): void {
    console.log('🔄 Refreshing HISTORIAL animations only');
    
    // Matar solo las animaciones del historial
    ScrollTrigger.getAll().forEach(st => {
      const trigger = st.trigger as HTMLElement;
      if (trigger && trigger.closest('.side.historial')) {
        st.kill();
      }
    });
    
    // Reconfigurar solo las animaciones de historial
    this._setupHistorialAnimations();
    
    // Refrescar ScrollTrigger
    ScrollTrigger.refresh();
  }

  private _setupContinuacionAnimations(): void {
    // Esperar activamente a que los elementos existan
    const checkAndSetup = (attempts = 0) => {
      const scroller = document.querySelector(".side.continuacion .canciones");
      if (!scroller) {
        if (attempts < 10) {
          setTimeout(() => checkAndSetup(attempts + 1), 50);
        } else {
          console.warn("Scroller continuacion not found after 10 attempts");
        }
        return;
      }

      const elementos = gsap.utils.toArray(".side.continuacion .canciones .cancion");
      console.log(`Setting up continuacion animations for ${elementos.length} elements`);
      
      if (elementos.length === 0 && attempts < 10) {
        setTimeout(() => checkAndSetup(attempts + 1), 50);
        return;
      }
      
      elementos.forEach((element: any) => {
        // Matar cualquier ScrollTrigger existente en este elemento
        ScrollTrigger.getAll().forEach(st => {
          if (st.trigger === element) {
            st.kill();
          }
        });
        gsap.killTweensOf(element);

        // Verificar si el elemento ya está visible en el viewport
        const elementRect = element.getBoundingClientRect();
        const scrollerRect = (scroller as HTMLElement).getBoundingClientRect();
        const isAlreadyVisible = elementRect.top < scrollerRect.bottom && elementRect.bottom > scrollerRect.top;

        if (isAlreadyVisible) {
          // Si ya está visible, establecer directamente en estado final sin animación
          gsap.set(element, { opacity: 1, y: 0, scale: 1 });
        } else {
          // Si no está visible, configurar animación que se activará con scroll
          gsap.set(element, { opacity: 0, y: 50, scale: 0.65 });

          gsap.to(element, {
            opacity: 1,
            y: 0,
            scale: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              scroller: scroller,
              start: "top 95%",
              end: "top 95%",
              scrub: 1,
              id: `continuacion-${element.getAttribute('data-song-id') || Math.random()}`
            }
          });
        }
      });
      
      // Forzar refresh de ScrollTrigger
      ScrollTrigger.refresh();
    };
    
    requestAnimationFrame(() => {
      setTimeout(() => checkAndSetup(), 100);
    });
  }

  private _setupHistorialAnimations(): void {
    const scroller = document.querySelector(".side.historial .canciones");
    if (!scroller) {
      console.warn("Scroller historial not found");
      return;
    }

    const elementos = gsap.utils.toArray(".side.historial .canciones .cancion");
    console.log(`📜 Setting up historial animations for ${elementos.length} elements`);
    
    if (elementos.length === 0) {
      console.warn("No elements found for historial animations");
      return;
    }
    
    elementos.forEach((element: any) => {
      gsap.killTweensOf(element);

      // Verificar si el elemento ya está visible en el viewport
      const elementRect = element.getBoundingClientRect();
      const scrollerRect = (scroller as HTMLElement).getBoundingClientRect();
      const isAlreadyVisible = elementRect.top < scrollerRect.bottom && elementRect.bottom > scrollerRect.top;

      if (isAlreadyVisible) {
        // Si ya está visible, establecer directamente en estado final sin animación
        gsap.set(element, { opacity: 1, y: 0, scale: 1 });
      } else {
        // Si no está visible, configurar animación que se activará con scroll
        gsap.set(element, { opacity: 0, y: 50, scale: 0.65 });

        gsap.to(element, {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            scroller: scroller,
            start: "top 95%",
            end: "top 95%", // hasta dónde llega el efecto
            scrub: 1, // <- esta es la clave
            // markers: true,
            id: `historial-${Math.random()}`
          }
        });
      }
    });
    
    console.log('✅ Historial animations setup complete');
  }


  aContinuacion: any[] = [];
  establecimientoId: number | null = null;
  loading = true; // Solo para la carga inicial

  historial: Cancion[] = [];

  menuAbierto: number | null = null;
  isDeleting = false; // ✅ Flag para evitar recargas durante eliminación
  deletingIds: Set<number> = new Set(); // ✅ IDs de canciones que se están eliminando
  
  // Variables para drag and drop
  draggedSongId: number | null = null;
  dragOverSongId: number | null = null;
  dragLeaveTimeout: any = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private spotifyService: SpotifyService,
    private estService: EstablecimientosService,
    private musicaSocketService: MusicaSocketService
  ) {}

  async ngOnInit() {
    // Obtener el establecimiento actual
    try {
      const establecimientoResponse = await this.estService.getMiEstablecimiento().toPromise();
      if (establecimientoResponse?.establecimiento) {
        this.establecimientoId = establecimientoResponse.establecimiento.id_establecimiento;
        console.log('Establecimiento ID obtenido en lista:', this.establecimientoId);
        
        // Cargar la cola y el historial iniciales
        await this.cargarCola();
        await this.cargarHistorial();

        // Conectar al socket después de obtener el establecimiento
        this.musicaSocketService.connect(this.establecimientoId);
        this.setupSocketListeners();
      }
    } catch (error) {
      console.error('Error obteniendo establecimiento en lista:', error);
    } finally {
      this.loading = false;
    }

    window.addEventListener('spotifyTrackPlayed', () => {
      if (!this.isDeleting) {
        setTimeout(() => {
          this.cargarCola(false); // No refrescar animaciones al hacer skip
          this.cargarHistorial();
        }, 100);
      }
    });

    window.addEventListener('queueUpdated', () => {
      if (!this.isDeleting) {
        setTimeout(() => {
          this.cargarCola(false); // No refrescar animaciones al actualizar cola
        }, 100);
      }
    });

    window.addEventListener('historyUpdated', () => {
      if (!this.isDeleting) {
        setTimeout(() => {
          this.cargarHistorial();
        }, 100);
      }
    });

    // El socket ya está conectado por el LayoutComponent/PlaybackService
    // No debemos conectarnos ni desconectarnos aquí
  }

  ngOnDestroy() {
    // No desconectar el socket aquí porque es compartido entre componentes
  }

  private setupSocketListeners() {
    // El socket service ya tiene listeners configurados en su conexión
    // Los eventos ya se manejan en el servicio, solo necesitamos que se
    // disparen los eventos window que ya están configurados
    
    // Nota: El backend ya emite queue_update y history_update via Socket.IO
    // El MusicaSocketService ya tiene los listeners configurados
    // Los componentes se actualizarán vía los window.dispatchEvent existentes
  }

  async cargarCola(refreshAnimations: boolean = true) {
    if (!this.establecimientoId) {
      console.error('No establecimiento ID available');
      return;
    }

    try {
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
          usuario_nombre: item.usuario_nombre && item.usuario_nombre.trim() ? item.usuario_nombre.trim() : null,
          agregada_en: item.agregada_en
        }));
        
        // Refrescar SOLO las animaciones de la cola/continuación (solo si se solicita)
        if (refreshAnimations && isPlatformBrowser(this.platformId) && !this.hidden) {
          // Dar tiempo suficiente para que Angular renderice con *ngIf
          setTimeout(() => {
            this._refreshContinuacionAnimations();
          }, 200);
        }
      }
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  }

  async cargarHistorial() {
    if (!this.establecimientoId) {
      return;
    }

    try {
      const response = await this.spotifyService.getHistory(this.establecimientoId, 100).toPromise();
      
      if (response?.success) {
        this.historial = response.history.map((item: any) => ({
          id: item.id_historial,
          nombre: item.titulo,
          artista: item.artista,
          duracion: this.formatDuration(item.duracion),
          album: item.album,
          imagen_url: item.imagen_url,
          usuario_id: item.usuario_id,
          usuario_nombre: item.usuario_nombre && item.usuario_nombre.trim() ? item.usuario_nombre.trim() : null
        }));
        
        
        // Refrescar SOLO las animaciones del historial
        if (isPlatformBrowser(this.platformId) && !this.hidden) {
          setTimeout(() => {
            this._refreshHistorialAnimations();
          }, 100);
        }
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
      
      // 3. Eliminar del array local directamente (sin animación GSAP)
      const indexToRemove = this.aContinuacion.findIndex(item => item.id === cancion.id);
      if (indexToRemove !== -1) {
        this.aContinuacion.splice(indexToRemove, 1);
        console.log('✅ Removed from local array');
      }
      
      this.menuAbierto = null;
      // 
      // ScrollTrigger.refresh();
      
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

  // ===== DRAG AND DROP METHODS =====
  
  onDragStart(event: DragEvent, cancion: any) {
    this.draggedSongId = cancion.id;
    
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', cancion.id.toString());
    }
    
    console.log('🎵 Drag started:', cancion.titulo, 'ID:', cancion.id, 'Position:', cancion.posicion);
  }

  onDragEnd(event: DragEvent) {
    this.draggedSongId = null;
    this.dragOverSongId = null;
    
    // Limpiar timeout pendiente
    if (this.dragLeaveTimeout) {
      clearTimeout(this.dragLeaveTimeout);
      this.dragLeaveTimeout = null;
    }
    
    console.log('🎵 Drag ended');
  }

  onDragOver(event: DragEvent, cancion: any) {
    event.preventDefault(); // Necesario para permitir drop
    event.stopPropagation();
    
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    
    // Mantener el highlight activo mientras estamos sobre el elemento
    if (this.draggedSongId !== null && this.draggedSongId !== cancion.id) {
      if (this.dragOverSongId !== cancion.id) {
        this.dragOverSongId = cancion.id;
      }
      
      // Cancelar cualquier timeout pendiente de dragleave
      if (this.dragLeaveTimeout) {
        clearTimeout(this.dragLeaveTimeout);
        this.dragLeaveTimeout = null;
      }
    }
  }

  onDragEnter(event: DragEvent, cancion: any) {
    event.preventDefault();
    event.stopPropagation();
    
    // Cancelar timeout de dragleave
    if (this.dragLeaveTimeout) {
      clearTimeout(this.dragLeaveTimeout);
      this.dragLeaveTimeout = null;
    }
    
    if (this.draggedSongId !== null && this.draggedSongId !== cancion.id) {
      this.dragOverSongId = cancion.id;
    }
  }

  onDragLeave(event: DragEvent, cancion: any) {
    event.preventDefault();
    event.stopPropagation();
    
    // Usar timeout para evitar flickering cuando pasamos sobre elementos hijos
    if (this.dragLeaveTimeout) {
      clearTimeout(this.dragLeaveTimeout);
    }
    
    this.dragLeaveTimeout = setTimeout(() => {
      // Verificar si realmente salimos del elemento
      const currentElement = document.querySelector(`.cancion[data-song-id="${cancion.id}"]`);
      if (currentElement) {
        const rect = currentElement.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // Solo quitar el highlight si el mouse está fuera del elemento
        if (mouseX < rect.left || mouseX > rect.right || 
            mouseY < rect.top || mouseY > rect.bottom) {
          if (this.dragOverSongId === cancion.id) {
            this.dragOverSongId = null;
          }
        }
      }
    }, 50); // 50ms de delay para evitar flickering
  }

  async onDrop(event: DragEvent, dropCancion: any) {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.draggedSongId === null || this.draggedSongId === dropCancion.id) {
      this.dragOverSongId = null;
      return;
    }

    const draggedCancion = this.aContinuacion.find(c => c.id === this.draggedSongId);
    
    if (!draggedCancion) {
      console.error('Dragged song not found');
      this.draggedSongId = null;
      this.dragOverSongId = null;
      return;
    }
    
    // Calcular la posición objetivo considerando que la posición 1 no se muestra
    // Obtener todas las canciones visibles (sin la posición 1)
    const visibleSongs = this.aContinuacion.filter(c => c.posicion !== 1);
    const draggedIndex = visibleSongs.findIndex(c => c.id === this.draggedSongId);
    const dropIndex = visibleSongs.findIndex(c => c.id === dropCancion.id);
    
    if (draggedIndex === -1 || dropIndex === -1) {
      console.error('Invalid drag/drop indices');
      this.draggedSongId = null;
      this.dragOverSongId = null;
      return;
    }
    
    // Calcular la posición objetivo en BD
    // Cuando soltamos una canción sobre otra, queremos que vaya a esa posición exacta
    // El backend manejará correctamente el reordenamiento
    const targetPosition = dropCancion.posicion;
    
    console.log('🎵 Dropping:', draggedCancion.titulo, '(pos BD:', draggedCancion.posicion, ', visual:', draggedIndex, ')');
    console.log('🎵 Onto:', dropCancion.titulo, '(pos BD:', dropCancion.posicion, ', visual:', dropIndex, ')');
    console.log('🎯 Target position in BD:', targetPosition);

    try {
      // Actualizar en el backend primero
      await this.reordenarCola(draggedCancion.id, targetPosition);
      
      console.log('✅ Queue reordered successfully');
      
    } catch (error) {
      console.error('❌ Error reordering queue:', error);
      // Recargar la cola si hay error
      await this.cargarCola();
    } finally {
      this.draggedSongId = null;
      this.dragOverSongId = null;
      
      // Limpiar timeout pendiente
      if (this.dragLeaveTimeout) {
        clearTimeout(this.dragLeaveTimeout);
        this.dragLeaveTimeout = null;
      }
    }
  }

  async reordenarCola(cancionId: number, nuevaPosicion: number) {
    if (!this.establecimientoId) {
      throw new Error('No establecimiento ID');
    }

    try {
      const response = await this.spotifyService.reorderQueue(
        cancionId,
        nuevaPosicion,
        this.establecimientoId
      ).toPromise();

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to reorder queue');
      }

      console.log('🔄 Queue reordered, reloading without refreshing animations...');
      // Recargar para tener el orden correcto desde el backend (sin refrescar animaciones)
      await this.cargarCola(false);
      
      // Emitir evento de socket para notificar a todos los clientes (incluyendo vista pública)
      this.musicaSocketService.emitQueueUpdate(this.establecimientoId);
      
      // Disparar evento window para misma pestaña/ventana
      window.dispatchEvent(new CustomEvent('queueUpdated'));
      
      console.log('✅ Queue updated events dispatched');
    } catch (error: any) {
      console.error('Error in reordenarCola:', error);
      // Si el error tiene un mensaje, lanzarlo
      if (error?.error?.error) {
        throw new Error(error.error.error);
      }
      throw error;
    }
  }
}
