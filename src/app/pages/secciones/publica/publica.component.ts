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
  currentLineIndex: number = 0;
  private loadedTrackId: string | null = null;
  private readonly LYRICS_OFFSET = -1.8;

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
    private route: ActivatedRoute
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
        
        if (queue.length === 0 && response.queue.length > 0) {
          this.nextTrack = response.queue[0];
        } else if (queue.length === response.queue.length && queue.length > 1) {
          this.nextTrack = response.queue[1];
        } else {
          this.nextTrack = queue.length > 0 ? queue[0] : null;
        }
      } else {
        this.nextTrack = null;
      }
    } catch (error) {
      console.error('Error fetching next track:', error);
    }
  }

  private subscribeToSocketEvents(): void {
    const unsubPlaybackUpdate = this.musicaSocketService.on('playback_update', (data: any) => {
      this.ngZone.run(() => {
        if (data.currentTrack) {
          if (this.loadedTrackId !== data.currentTrack.spotify_id) {
            this.currentTrack = data.currentTrack;
            this.loadLyrics(data.currentTrack);
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
      this.ngZone.run(() => this.fetchNextTrack());
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
    this.currentLineIndex = 0;

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
            this.currentLineIndex = 0;
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
    if (!this.isSynced || this.lyrics.length === 0 || !this.isPlaying) return;
    const adjustedTime = this.currentTime - this.LYRICS_OFFSET;
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
    const currentLine = document.querySelector('.lyricLine.current') as HTMLElement;
    if (!container || !currentLine) return;
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

  getUserInitials(): string {
    const userName = this.currentTrack?.usuario_nombre;
    if (userName && userName.trim().length > 0) {
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
}
