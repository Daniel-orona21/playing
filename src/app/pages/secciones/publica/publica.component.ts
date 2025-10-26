import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
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
  // Current track and playback state
  currentTrack: SpotifyTrack | null = null;
  currentTime: number = 0; // in seconds
  totalDuration: number = 0; // in seconds
  isPlaying: boolean = false;

  // Next track in queue
  nextTrack: SpotifyTrack | null = null;

  // Lyrics
  lyrics: LyricLine[] = [];
  plainLyrics: string[] = [];
  isSynced: boolean = false;
  loading: boolean = false;
  currentLineIndex: number = 0;
  
  // Lyrics offset for sync adjustment (in seconds)
  private readonly LYRICS_OFFSET = -1.8;

  // Current date/time
  currentDate: Date = new Date();
  
  // Establecimiento ID from route
  establecimientoId: number | null = null;
  
  // Token from URL query params
  private token: string | null = null;

  // Unsubscribe functions for socket events
  private unsubscribers: (() => void)[] = [];
  private clockInterval: any = null;

  constructor(
    private musicaSocketService: MusicaSocketService,
    private lyricsService: LyricsService,
    private http: HttpClient,
    private ngZone: NgZone,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Get establecimientoId from route params
    this.route.params.subscribe(params => {
      const id = params['establecimientoId'];
      if (id) {
        this.establecimientoId = +id; // Convert to number
        
        // Get token from query params
        this.route.queryParams.subscribe(queryParams => {
          this.token = queryParams['token'] || null;
          
          // Store token in localStorage for API calls
          if (this.token) {
            localStorage.setItem('token', this.token);
          }
          
          // Start clock update
          this.updateClock();
          this.clockInterval = setInterval(() => this.updateClock(), 1000);

          // Initialize socket connection and fetch current playback state
          this.initializePlayback();
          
          // Listen for queue updates from window events (cross-tab/component communication)
          window.addEventListener('queueUpdated', () => {
            this.ngZone.run(() => {
              console.log('🔄 Vista pública: Actualización de cola recibida (window event)');
              this.fetchNextTrack();
            });
          });
        });
      } else {
        console.error('❌ No se proporcionó establecimientoId en la ruta');
      }
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from all socket events
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    // Clear clock interval
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
    
    // Disconnect socket
    this.musicaSocketService.disconnect();
  }

  private updateClock(): void {
    this.currentDate = new Date();
  }

  private async initializePlayback(): Promise<void> {
    if (!this.establecimientoId) {
      console.error('No hay establecimientoId disponible');
      return;
    }

    try {
      // Subscribe to socket events FIRST (like mobile app does)
      this.subscribeToSocketEvents();
      
      // Then connect to socket
      console.log('🔌 Vista pública: Conectando al socket para establecimiento:', this.establecimientoId);
      this.musicaSocketService.connect(this.establecimientoId);
      console.log('✅ Vista pública: Socket conectado:', this.musicaSocketService.isConnected());

      // Prepare headers with token if available
      const headers: any = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      // Fetch current playing track
      const response = await this.http.get<any>(
        `${environment.apiUrl}/musica/queue/current-playing?establecimientoId=${this.establecimientoId}`,
        { headers }
      ).toPromise();

      if (response?.success && response.currentPlaying) {
        this.currentTrack = response.currentPlaying;
        this.currentTime = 0;
        this.totalDuration = response.currentPlaying.duracion || 0;
        this.isPlaying = true;
        
        console.log('🎵 Track inicial con datos completos:', this.currentTrack);
        
        // Load lyrics for current track
        if (this.currentTrack) {
          this.loadLyrics(this.currentTrack);
        }
      }

      // Fetch next track in queue
      await this.fetchNextTrack();
    } catch (error) {
      console.error('Error initializing playback:', error);
    }
  }

  private async fetchCurrentTrackDetails(): Promise<void> {
    if (!this.establecimientoId) return;
    
    try {
      // Prepare headers with token if available
      const headers: any = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await this.http.get<any>(
        `${environment.apiUrl}/musica/queue/current-playing?establecimientoId=${this.establecimientoId}`,
        { headers }
      ).toPromise();

      if (response?.success && response.currentPlaying) {
        console.log('✅ Current track details obtenidos:', response.currentPlaying);
        // Merge with existing track data to preserve all fields
        this.currentTrack = {
          ...this.currentTrack,
          ...response.currentPlaying
        };
      }
    } catch (error) {
      console.error('Error fetching current track details:', error);
    }
  }

  private async fetchNextTrack(): Promise<void> {
    console.log('🔄 Fetching next track...');
    try {
      // Prepare headers with token if available
      const headers: any = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await this.http.get<any>(
        `${environment.apiUrl}/musica/queue?establecimientoId=${this.establecimientoId}`,
        { headers }
      ).toPromise();

      if (response?.success && response.queue && response.queue.length > 0) {
        console.log('📋 Cola completa recibida:', response.queue.map((t: any) => ({
          titulo: t.titulo,
          spotify_id: t.spotify_id,
          posicion: t.posicion
        })));
        console.log('🎵 Current track spotify_id:', this.currentTrack?.spotify_id);
        
        // La cola puede venir con la canción actual incluida o no
        // Intentar filtrar primero por spotify_id
        let queue = response.queue.filter((track: any) => 
          track.spotify_id !== this.currentTrack?.spotify_id
        );
        
        // Si después de filtrar la cola está vacía o tiene el mismo tamaño, 
        // probablemente la cola no incluye la actual, tomar desde posición 0
        // Si filtró algo, tomar el primero del array filtrado
        if (queue.length === 0 && response.queue.length > 0) {
          // Cola vacía después de filtrar, la cola no incluía la actual
          // Tomar la primera
          this.nextTrack = response.queue[0];
          console.log('✅ Next track (primera de cola):', this.nextTrack?.titulo);
        } else if (queue.length === response.queue.length && queue.length > 1) {
          // No filtró nada (no encontró la actual en la cola)
          // Probablemente posición 0 = actual, tomar posición 1
          this.nextTrack = response.queue[1];
          console.log('✅ Next track (posición 1):', this.nextTrack?.titulo);
        } else {
          // Filtró correctamente, tomar la primera del filtrado
          this.nextTrack = queue.length > 0 ? queue[0] : null;
          console.log('✅ Next track (después de filtrar):', this.nextTrack?.titulo);
        }
      } else {
        console.log('⚠️ No hay canciones en la cola');
        this.nextTrack = null;
      }
    } catch (error) {
      console.error('Error fetching next track:', error);
    }
  }

  private subscribeToSocketEvents(): void {
    // Listen for playback updates
    const unsubPlaybackUpdate = this.musicaSocketService.on('playback_update', (data: any) => {
      this.ngZone.run(() => {
        if (data.currentTrack) {
          console.log('📻 playback_update data.currentTrack:', data.currentTrack);
          
          // Check if it's a new track
          if (this.currentTrack?.spotify_id !== data.currentTrack.spotify_id) {
            this.currentTrack = data.currentTrack;
            this.loadLyrics(data.currentTrack);
            this.fetchNextTrack(); // Actualizar siguiente canción cuando cambia
            this.fetchCurrentTrackDetails(); // Obtener detalles completos incluyendo usuario
          }
          
          this.isPlaying = data.isPlaying || false;
          this.currentTime = Math.floor((data.position || 0) / 1000);
          this.totalDuration = data.currentTrack.duracion || 0;
          
          this.updateCurrentLyricLine();
        }
      });
    });

    // Listen for track started event
    const unsubTrackStarted = this.musicaSocketService.on('track_started', (data: any) => {
      this.ngZone.run(() => {
        if (data.track) {
          console.log('🎵 track_started data.track:', data.track);
          
          this.currentTrack = data.track;
          this.isPlaying = true;
          this.currentTime = 0;
          this.totalDuration = data.track.duracion || 0;
          this.currentLineIndex = 0;
          
          this.loadLyrics(data.track);
          this.fetchNextTrack(); // Actualizar siguiente canción
          this.fetchCurrentTrackDetails(); // Obtener detalles completos incluyendo usuario
        }
      });
    });

    // Listen for playback state changes
    const unsubPlaybackState = this.musicaSocketService.on('playback_state_change', (data: any) => {
      this.ngZone.run(() => {
        this.isPlaying = data.isPlaying || false;
        if (data.position !== undefined) {
          this.currentTime = Math.floor(data.position / 1000);
          this.updateCurrentLyricLine();
        }
      });
    });

    // Listen for playback progress
    const unsubProgress = this.musicaSocketService.on('playback_progress', (data: any) => {
      this.ngZone.run(() => {
        if (data.position !== undefined && data.duration !== undefined) {
          this.currentTime = Math.floor(data.position / 1000);
          this.totalDuration = Math.floor(data.duration / 1000);
          this.updateCurrentLyricLine();
        }
      });
    });

    // Listen for queue updates
    const unsubQueueUpdate = this.musicaSocketService.on('queue_update', (data: any) => {
      this.ngZone.run(() => {
        console.log('📋 Vista pública: Actualización de cola recibida (socket event)', data);
        this.fetchNextTrack();
      });
    });

    // Store unsubscribe functions
    this.unsubscribers.push(
      unsubPlaybackUpdate,
      unsubTrackStarted,
      unsubPlaybackState,
      unsubProgress,
      unsubQueueUpdate
    );
  }

  private loadLyrics(track: SpotifyTrack): void {
    if (!track) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.currentLineIndex = 0;

    this.lyricsService.getLyrics(
      track.titulo,
      track.artista,
      track.album,
      track.duracion,
      this.token || undefined
    ).subscribe({
      next: (response) => {
        if (response.success) {
          if (response.synced) {
            // Synced lyrics with timestamps
            this.lyrics = response.lyrics as LyricLine[];
            this.isSynced = true;
            this.plainLyrics = [];
            this.currentLineIndex = 0;
          } else {
            // Plain lyrics without timestamps
            this.plainLyrics = response.lyrics as string[];
            this.isSynced = false;
            this.lyrics = [];
          }
        } else {
          // No lyrics found
          this.plainLyrics = ['Letras no disponibles para esta canción'];
          this.isSynced = false;
          this.lyrics = [];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading lyrics:', error);
        this.plainLyrics = ['No se pudieron cargar las letras'];
        this.isSynced = false;
        this.lyrics = [];
        this.loading = false;
      }
    });
  }

  private updateCurrentLyricLine(): void {
    if (!this.isSynced || this.lyrics.length === 0 || !this.isPlaying) {
      return;
    }

    // Apply offset to compensate for latency
    const adjustedTime = this.currentTime - this.LYRICS_OFFSET;

    // Find the current line based on adjusted time
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
    // Auto-scroll with custom smooth animation (same as mobile app)
    const container = document.querySelector('.letrasContenido') as HTMLElement;
    const currentLine = document.querySelector('.lyricLine.current') as HTMLElement;
    
    if (!container || !currentLine) return;
    
    // Get positions relative to viewport
    const containerRect = container.getBoundingClientRect();
    const lineRect = currentLine.getBoundingClientRect();
    
    // Calculate how much to scroll to put line at top of container
    const scrollOffset = lineRect.top - containerRect.top;
    const targetScroll = container.scrollTop + scrollOffset;
    
    // Smooth scroll animation
    this.animateScroll(container, container.scrollTop, targetScroll, 800);
  }

  private animateScroll(element: HTMLElement, start: number, end: number, duration: number): void {
    const startTime = performance.now();
    
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

  // Helper methods for template
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

  getUserInitials(): string {
    // Try to get user name from current track
    const userName = this.currentTrack?.usuario_nombre;
    
    // Debug: log what we're receiving
    if (!userName) {
      console.log('⚠️ No usuario_nombre en currentTrack:', this.currentTrack);
    }
    
    if (userName && userName.trim().length > 0) {
      const nombres = userName.trim().split(' ');
      if (nombres.length >= 2) {
        // Two names: first letter of each
        return nombres[0].charAt(0).toUpperCase() + nombres[1].charAt(0).toUpperCase();
      } else if (nombres.length === 1) {
        // One name: first two letters
        if (nombres[0].length >= 2) {
          return nombres[0].substring(0, 2).toUpperCase();
        } else if (nombres[0].length === 1) {
          return nombres[0].charAt(0).toUpperCase() + nombres[0].charAt(0).toUpperCase();
        }
      }
    }
    
    return 'AN'; // Anonymous por defecto
  }

  getLikesCount(): number {
    return this.currentTrack?.likes_count || 0;
  }

  getSkipsCount(): number {
    return this.currentTrack?.skips_count || 0;
  }

  // Check if lyrics are available and valid
  // Solo consideramos válidas las letras sincronizadas con timestamps
  hasValidLyrics(): boolean {
    if (this.loading) return true; // Keep normal layout while loading
    
    // Solo aceptar letras sincronizadas (con timestamps para scroll y highlight)
    if (this.isSynced && this.lyrics.length > 0) {
      return true;
    }
    
    // Las letras planas (sin sincronización) no son válidas para el panel
    // Se manejan como si no hubiera letras
    return false;
  }
}
