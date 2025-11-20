import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MusicaSocketService } from '../../../services/musica-socket.service';
import { LyricsService, LyricLine } from '../../../services/lyrics.service';
import { environment } from '../../../../environments/environment';

export interface SpotifyTrack {
  spotify_id: string;
  titulo: string;
  artista: string;
  album?: string;
  duracion: number;
  imagen_url?: string;
  usuario_nombre?: string;
  likes_count?: number;
  skips_count?: number;
}

@Component({
  selector: 'app-publica',
  imports: [CommonModule],
  templateUrl: './publica.component.html',
  styleUrl: './publica.component.scss'
})
export class PublicaComponent implements OnInit, OnDestroy {
  currentTrack: SpotifyTrack | null = null;
  currentTime: number = 0;
  totalDuration: number = 0;
  isPlaying: boolean = false;
  nextTrack: SpotifyTrack | null = null;

  // Lyrics
  lyrics: LyricLine[] = [];
  plainLyrics: string[] = [];
  isSynced: boolean = false;
  loading: boolean = false;
  currentLineIndex: number = -1; // -1 significa que estamos antes de la primera línea
  private loadedTrackId: string | null = null;
  private readonly LYRICS_OFFSET = -1.8;

  // Background colors from album cover
  backgroundColors: string[] = [];
  backgroundGradient: string = '';
  previousBackgroundGradient: string = '';
  isTransitioningBackground: boolean = false;
  shouldFadeOut: boolean = false;

  // Cover image transitions
  currentCoverUrl: string = '';
  previousCoverUrl: string = '';
  shouldFadeOutCurrentCover: boolean = false;
  nextCoverUrl: string = '';
  previousNextCoverUrl: string = '';
  shouldFadeOutNextCover: boolean = false;

  currentDate: Date = new Date();
  establecimientoId: number | null = null;
  private token: string | null = null;
  private unsubscribers: (() => void)[] = [];
  private clockInterval: any = null;

  constructor(
    private musicaSocketService: MusicaSocketService,
    private lyricsService: LyricsService,
    private http: HttpClient,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['establecimientoId'];
      if (id) {
        this.establecimientoId = +id;
        this.route.queryParams.subscribe(queryParams => {
          this.token = queryParams['token'] || null;
          if (this.token) {
            localStorage.setItem('token', this.token);
          }
          this.updateClock();
          this.clockInterval = setInterval(() => this.updateClock(), 1000);
          this.initializePlayback();
          window.addEventListener('queueUpdated', () => {
            this.ngZone.run(() => this.fetchNextTrack());
          });
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.musicaSocketService.disconnect();
  }

  private updateClock(): void {
    this.currentDate = new Date();
  }

  private async initializePlayback(): Promise<void> {
    if (!this.establecimientoId) return;

    try {
      this.subscribeToSocketEvents();
      this.musicaSocketService.connect(this.establecimientoId);

      const headers: any = {};
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

      const response = await this.http.get<any>(
        `${environment.apiUrl}/musica/queue/current-playing?establecimientoId=${this.establecimientoId}`,
        { headers }
      ).toPromise();

      if (response?.success && response.currentPlaying) {
        this.currentTrack = response.currentPlaying;
        this.currentTime = 0;
        this.totalDuration = response.currentPlaying.duracion || 0;
        this.isPlaying = true;
        this.extractColorsFromCover(response.currentPlaying.imagen_url);
        // Inicializar la portada actual sin transición la primera vez
        this.currentCoverUrl = response.currentPlaying.imagen_url || '';
      }
      await this.fetchNextTrack();
    } catch (error) {
      console.error('Error initializing playback:', error);
    }
  }

  private async fetchNextTrack(): Promise<void> {
    try {
      const headers: any = {};
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

      const response = await this.http.get<any>(
        `${environment.apiUrl}/musica/queue?establecimientoId=${this.establecimientoId}`,
        { headers }
      ).toPromise();

      if (response?.success && response.queue && response.queue.length > 0) {
        let queue = response.queue.filter((track: any) => 
          track.spotify_id !== this.currentTrack?.spotify_id
        );
        
        let newNextTrack = null;
        if (queue.length === 0 && response.queue.length > 0) {
          newNextTrack = response.queue[0];
        } else if (queue.length === response.queue.length && queue.length > 1) {
          newNextTrack = response.queue[1];
        } else {
          newNextTrack = queue.length > 0 ? queue[0] : null;
        }
        
        // Actualizar nextTrack y hacer transición si cambió
        if (newNextTrack?.spotify_id !== this.nextTrack?.spotify_id) {
          this.nextTrack = newNextTrack;
          if (this.nextCoverUrl === '') {
            // Primera vez, inicializar sin transición
            this.nextCoverUrl = newNextTrack?.imagen_url || '';
          } else {
            // Transición suave
            this.updateNextCoverWithTransition(newNextTrack?.imagen_url);
          }
        }
      } else {
        if (this.nextTrack !== null) {
          this.nextTrack = null;
          this.updateNextCoverWithTransition(undefined);
        }
      }
    } catch (error) {
      console.error('Error fetching next track:', error);
    }
  }

  private async reloadCurrentTrack(): Promise<void> {
    if (!this.establecimientoId || !this.currentTrack) return;

    try {
      const headers: any = {};
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

      const response = await this.http.get<any>(
        `${environment.apiUrl}/musica/queue/current-playing?establecimientoId=${this.establecimientoId}`,
        { headers }
      ).toPromise();

      if (response?.success && response.currentPlaying) {
        // Actualizar solo el usuario_nombre si es la misma canción
        if (this.currentTrack.spotify_id === response.currentPlaying.spotify_id) {
          this.currentTrack = {
            ...this.currentTrack,
            usuario_nombre: response.currentPlaying.usuario_nombre || 'Anónimo'
          };
        } else {
          // Si cambió la canción, actualizar completamente
          this.currentTrack = response.currentPlaying;
          this.loadLyrics(response.currentPlaying);
          this.extractColorsFromCover(response.currentPlaying.imagen_url);
          this.updateCurrentCoverWithTransition(response.currentPlaying.imagen_url);
        }
      }
    } catch (error) {
      console.error('Error reloading current track:', error);
    }
  }

  private subscribeToSocketEvents(): void {
    const unsubPlaybackUpdate = this.musicaSocketService.on('playback_update', (data: any) => {
      this.ngZone.run(() => {
        if (data.currentTrack) {
          if (this.loadedTrackId !== data.currentTrack.spotify_id) {
            this.currentTrack = data.currentTrack;
            this.loadLyrics(data.currentTrack);
            this.extractColorsFromCover(data.currentTrack.imagen_url);
            this.updateCurrentCoverWithTransition(data.currentTrack.imagen_url);
          }
          this.isPlaying = data.isPlaying || false;
          this.currentTime = Math.floor((data.position || 0) / 1000);
          this.totalDuration = data.currentTrack.duracion || 0;
          this.updateCurrentLyricLine();
        }
      });
    });

    const unsubProgress = this.musicaSocketService.on('playback_progress', (data: any) => {
      this.ngZone.run(() => {
        if (data.position !== undefined && data.duration !== undefined) {
          this.currentTime = Math.floor(data.position / 1000);
          this.totalDuration = Math.floor(data.duration / 1000);
          this.updateCurrentLyricLine();
        }
      });
    });

    const unsubTrackStarted = this.musicaSocketService.on('track_started', (data: any) => {
      this.ngZone.run(() => this.fetchNextTrack());
    });

    const unsubPlaybackState = this.musicaSocketService.on('playback_state_change', (data: any) => {
      this.ngZone.run(() => {
        this.isPlaying = data.isPlaying || false;
        if (data.position !== undefined) {
          this.currentTime = Math.floor(data.position / 1000);
          this.updateCurrentLyricLine();
        }
      });
    });

    const unsubQueueUpdate = this.musicaSocketService.on('queue_update', (data: any) => {
      this.ngZone.run(() => {
        this.fetchNextTrack();
        // Recargar el track actual para obtener usuario_nombre actualizado
        this.reloadCurrentTrack();
      });
    });

    const unsubVotesUpdate = this.musicaSocketService.on('votes_update', (data: any) => {
      this.ngZone.run(() => {
        if (this.currentTrack) {
          this.currentTrack = {
            ...this.currentTrack,
            likes_count: data.likes,
            skips_count: data.skips
          };
        }
      });
    });

    const unsubTrackSkipped = this.musicaSocketService.on('track_skipped', (data: any) => {
      this.ngZone.run(() => {});
    });

    this.unsubscribers.push(
      unsubPlaybackUpdate,
      unsubTrackStarted,
      unsubPlaybackState,
      unsubProgress,
      unsubQueueUpdate,
      unsubVotesUpdate,
      unsubTrackSkipped
    );
  }

  private loadLyrics(track: SpotifyTrack): void {
    if (!track) {
      this.loading = false;
      return;
    }

    if (this.loadedTrackId === track.spotify_id) {
      return;
    }

    this.loadedTrackId = track.spotify_id;
    this.loading = true;
    this.currentLineIndex = -1; // Empezar antes de la primera línea

    setTimeout(() => {
      const container = document.querySelector('.letrasContenido') as HTMLElement;
      if (container) container.scrollTop = 0;
    }, 0);

    this.lyricsService.getLyrics(
      track.titulo,
      track.artista,
      track.album,
      track.duracion,
      this.token || undefined
    ).subscribe({
      next: (response) => {
        if (response.success && response.synced) {
            this.lyrics = response.lyrics as LyricLine[];
            this.isSynced = true;
            this.currentLineIndex = -1; // Empezar antes de la primera línea
        } else {
          this.lyrics = [];
          this.isSynced = false;
        }
        this.loading = false;
      },
      error: (error) => {
        this.lyrics = [];
        this.isSynced = false;
        this.loading = false;
      }
    });
  }

  private updateCurrentLyricLine(): void {
    if (!this.isSynced || this.lyrics.length === 0) return;
    
    // Si no está reproduciéndose, mantener el índice actual o establecerlo a -1 si es necesario
    if (!this.isPlaying) {
      const adjustedTime = this.currentTime - this.LYRICS_OFFSET;
      if (adjustedTime < this.lyrics[0].time && this.currentLineIndex !== -1) {
        this.currentLineIndex = -1;
      }
      return;
    }
    
    const adjustedTime = this.currentTime - this.LYRICS_OFFSET;
    
    // Si el tiempo es menor que la primera línea, estar antes de la primera línea
    if (adjustedTime < this.lyrics[0].time) {
      if (this.currentLineIndex !== -1) {
        this.currentLineIndex = -1;
        this.scrollToCurrentLine();
      }
      return;
    }
    
    // Buscar la línea actual
    let newIndex = 0;
    for (let i = 0; i < this.lyrics.length; i++) {
      if (this.lyrics[i].time <= adjustedTime) {
        newIndex = i;
      } else {
        break;
      }
    }
    
    if (newIndex !== this.currentLineIndex) {
      this.currentLineIndex = newIndex;
      this.scrollToCurrentLine();
    }
  }

  private scrollToCurrentLine(): void {
    const container = document.querySelector('.letrasContenido') as HTMLElement;
    if (!container) return;
    
    // Si estamos antes de la primera línea, hacer scroll al inicio
    if (this.currentLineIndex === -1) {
      this.animateScroll(container, container.scrollTop, 0, 800);
      return;
    }
    
    const currentLine = document.querySelector('.lyricLine.current') as HTMLElement;
    if (!currentLine) return;
    
    const containerRect = container.getBoundingClientRect();
    const lineRect = currentLine.getBoundingClientRect();
    const scrollOffset = lineRect.top - containerRect.top;
    const targetScroll = container.scrollTop + scrollOffset;
    this.animateScroll(container, container.scrollTop, targetScroll, 800);
  }

  private animateScroll(element: HTMLElement, start: number, end: number, duration: number): void {
    const startTime = performance.now();
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    const scroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      element.scrollTop = start + (end - start) * eased;
      if (progress < 1) {
        requestAnimationFrame(scroll);
      }
    };
    requestAnimationFrame(scroll);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getProgress(): number {
    if (this.totalDuration === 0) return 0;
    return (this.currentTime / this.totalDuration) * 100;
  }

  getRemainingTime(): number {
    return this.totalDuration - this.currentTime;
  }

  getFormattedDate(): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const day = days[this.currentDate.getDay()];
    const date = this.currentDate.getDate();
    const month = months[this.currentDate.getMonth()];
    return `${day} ${date} ${month}`;
  }

  getFormattedTime(): { hours: string, minutes: string } {
    const hours = this.currentDate.getHours().toString().padStart(2, '0');
    const minutes = this.currentDate.getMinutes().toString().padStart(2, '0');
    return { hours, minutes };
  }

  isCurrentLine(index: number): boolean {
    return this.isSynced && index === this.currentLineIndex;
  }

  isBeforeFirstLine(): boolean {
    return this.isSynced && this.currentLineIndex === -1;
  }

  getUserInitials(): string {
    const userName = this.currentTrack?.usuario_nombre;
    if (userName && userName.trim().length > 0 && userName !== 'Anónimo') {
      const nombres = userName.trim().split(' ');
      if (nombres.length >= 2) {
        return nombres[0].charAt(0).toUpperCase() + nombres[1].charAt(0).toUpperCase();
      } else if (nombres.length === 1) {
        if (nombres[0].length >= 2) {
          return nombres[0].substring(0, 2).toUpperCase();
        } else if (nombres[0].length === 1) {
          return nombres[0].charAt(0).toUpperCase() + nombres[0].charAt(0).toUpperCase();
        }
      }
    }
    return 'AN';
  }

  getLikesCount(): number {
    return this.currentTrack?.likes_count || 0;
  }

  getSkipsCount(): number {
    return this.currentTrack?.skips_count || 0;
  }

  hasValidLyrics(): boolean {
    return this.isSynced && this.lyrics.length > 0;
  }

  /**
   * Extrae colores dominantes de la portada del álbum y los aplica como fondo
   */
  private extractColorsFromCover(imageUrl: string | undefined): void {
    if (!imageUrl) {
      this.backgroundColors = [];
      this.backgroundGradient = '';
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;

        // Reducir tamaño para mejor rendimiento
        const size = 100;
        canvas.width = size;
        canvas.height = size;
        
        ctx.drawImage(img, 0, 0, size, size);
        
        // Obtener datos de píxeles
        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;
        
        // Agrupar colores similares
        const colorMap = new Map<string, number>();
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Ignorar píxeles muy transparentes o muy oscuros/claros
          if (a < 128) continue;
          
          // Agrupar colores similares (reducir precisión)
          const rGroup = Math.floor(r / 16) * 16;
          const gGroup = Math.floor(g / 16) * 16;
          const bGroup = Math.floor(b / 16) * 16;
          
          const key = `${rGroup},${gGroup},${bGroup}`;
          colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
        
        // Ordenar por frecuencia y obtener los más comunes
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([color]) => {
            const [r, g, b] = color.split(',').map(Number);
            return `rgb(${r}, ${g}, ${b})`;
          });
        
        // Filtrar colores muy similares y asegurar contraste
        const uniqueColors = this.filterSimilarColors(sortedColors);
        
        // Si no hay suficientes colores, generar variaciones
        if (uniqueColors.length < 2) {
          if (uniqueColors.length === 1) {
            const baseColor = uniqueColors[0];
            const [r, g, b] = this.extractRGB(baseColor);
            // Crear variaciones más oscuras y más claras
            uniqueColors.push(`rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`);
            uniqueColors.push(`rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`);
          } else {
            // Fallback a colores neutros
            uniqueColors.push('rgb(30, 30, 30)', 'rgb(50, 50, 50)');
          }
        }
        
        this.backgroundColors = uniqueColors;
        this.createGradientWithTransition();
      } catch (error) {
        console.error('Error extracting colors:', error);
        this.backgroundColors = [];
        this.backgroundGradient = '';
      }
    };
    
    img.onerror = () => {
      this.backgroundColors = [];
      this.createGradientWithTransition();
    };
    
    img.src = imageUrl;
  }

  /**
   * Filtra colores muy similares para obtener una paleta más variada
   */
  private filterSimilarColors(colors: string[]): string[] {
    const filtered: string[] = [];
    const threshold = 40; // Diferencia mínima entre colores
    
    for (const color of colors) {
      const [r, g, b] = this.extractRGB(color);
      let isSimilar = false;
      
      for (const existingColor of filtered) {
        const [er, eg, eb] = this.extractRGB(existingColor);
        const distance = Math.sqrt(
          Math.pow(r - er, 2) + Math.pow(g - eg, 2) + Math.pow(b - eb, 2)
        );
        
        if (distance < threshold) {
          isSimilar = true;
          break;
        }
      }
      
      if (!isSimilar) {
        filtered.push(color);
      }
      
      if (filtered.length >= 3) break; // Máximo 3 colores
    }
    
    return filtered.length > 0 ? filtered : colors.slice(0, 2);
  }

  /**
   * Extrae valores RGB de un string rgb(r, g, b)
   */
  private extractRGB(color: string): [number, number, number] {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
    }
    return [0, 0, 0];
  }

  /**
   * Crea un gradiente a partir de los colores extraídos
   */
  private createGradient(): string {
    if (this.backgroundColors.length === 0) {
      return '';
    }
    
    if (this.backgroundColors.length === 1) {
      return this.backgroundColors[0];
    }
    
    // Crear gradiente radial similar a Apple Music con múltiples capas
    const colors = this.backgroundColors;
    
    if (colors.length === 2) {
      // Gradiente simple de dos colores
      return `radial-gradient(circle at 30% 50%, ${colors[0]} 0%, ${colors[1]} 100%)`;
    } else {
      // Gradiente con múltiples colores
      const gradientStops = colors
        .map((color, index) => {
          const position = (index / (colors.length - 1)) * 100;
          return `${color} ${position}%`;
        })
        .join(', ');
      
      return `radial-gradient(ellipse at top left, ${gradientStops})`;
    }
  }

  /**
   * Crea el gradiente con transición suave desde el anterior
   */
  private createGradientWithTransition(): void {
    const newGradient = this.createGradient();
    
    // Si hay un gradiente anterior y es diferente, hacer transición
    if (this.backgroundGradient && this.backgroundGradient !== newGradient && this.backgroundGradient !== '') {
      // Guardar el gradiente anterior ANTES de cambiar el actual
      const oldGradient = this.backgroundGradient;
      
      // Paso 1: Establecer la capa anterior visible (sin fade-out)
      this.previousBackgroundGradient = oldGradient;
      this.shouldFadeOut = false;
      this.isTransitioningBackground = true;
      
      // Forzar detección de cambios para renderizar la capa anterior
      this.cdr.detectChanges();
      
      // Paso 2: Esperar a que el navegador renderice la capa anterior
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Paso 3: Ahora actualizar el gradiente actual (debajo de la capa anterior)
          this.backgroundGradient = newGradient;
          this.cdr.detectChanges();
          
          // Paso 4: Esperar un frame más para asegurar que el nuevo fondo esté renderizado
          requestAnimationFrame(() => {
            // Paso 5: Iniciar la transición de opacidad aplicando la clase fade-out
            setTimeout(() => {
              this.shouldFadeOut = true;
              this.cdr.detectChanges();
              
              // Paso 6: Limpiar después de la transición
              setTimeout(() => {
                this.isTransitioningBackground = false;
                this.previousBackgroundGradient = '';
                this.shouldFadeOut = false;
                this.cdr.detectChanges();
              }, 1600); // Un poco más que la duración de la transición CSS (1.5s)
            }, 16); // ~1 frame a 60fps
          });
        });
      });
    } else {
      // Primera vez o mismo gradiente
      this.backgroundGradient = newGradient;
      this.previousBackgroundGradient = '';
      this.shouldFadeOut = false;
    }
  }

  /**
   * Obtiene el estilo de fondo para aplicar al componente
   */
  getBackgroundStyle(): { [key: string]: string } {
    return {};
  }

  /**
   * Actualiza la portada actual con transición suave
   */
  private updateCurrentCoverWithTransition(newUrl: string | undefined): void {
    const url = newUrl || '';
    
    if (this.currentCoverUrl && this.currentCoverUrl !== url && this.currentCoverUrl !== '') {
      // Guardar la portada anterior
      this.previousCoverUrl = this.currentCoverUrl;
      this.shouldFadeOutCurrentCover = false;
      
      // Forzar detección de cambios
      this.cdr.detectChanges();
      
      // Esperar a que se renderice la capa anterior
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Actualizar la portada actual
          this.currentCoverUrl = url;
          this.cdr.detectChanges();
          
          // Iniciar la transición
          requestAnimationFrame(() => {
            setTimeout(() => {
              this.shouldFadeOutCurrentCover = true;
              this.cdr.detectChanges();
              
              // Limpiar después de la transición
              setTimeout(() => {
                this.previousCoverUrl = '';
                this.shouldFadeOutCurrentCover = false;
                this.cdr.detectChanges();
              }, 1500);
            }, 16);
          });
        });
      });
    } else {
      // Primera vez o mismo URL
      this.currentCoverUrl = url;
      this.previousCoverUrl = '';
      this.shouldFadeOutCurrentCover = false;
    }
  }

  /**
   * Actualiza la portada siguiente con transición suave
   */
  private updateNextCoverWithTransition(newUrl: string | undefined): void {
    const url = newUrl || '';
    
    if (this.nextCoverUrl && this.nextCoverUrl !== url && this.nextCoverUrl !== '') {
      // Guardar la portada anterior
      this.previousNextCoverUrl = this.nextCoverUrl;
      this.shouldFadeOutNextCover = false;
      
      // Forzar detección de cambios
      this.cdr.detectChanges();
      
      // Esperar a que se renderice la capa anterior
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Actualizar la portada siguiente
          this.nextCoverUrl = url;
          this.cdr.detectChanges();
          
          // Iniciar la transición
          requestAnimationFrame(() => {
            setTimeout(() => {
              this.shouldFadeOutNextCover = true;
              this.cdr.detectChanges();
              
              // Limpiar después de la transición
              setTimeout(() => {
                this.previousNextCoverUrl = '';
                this.shouldFadeOutNextCover = false;
                this.cdr.detectChanges();
              }, 1500);
            }, 16);
          });
        });
      });
    } else {
      // Primera vez o mismo URL
      this.nextCoverUrl = url;
      this.previousNextCoverUrl = '';
      this.shouldFadeOutNextCover = false;
    }
  }
}
