import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { PlaybackService } from '../../services/playback.service';
import { SpotifyTrack } from '../../models/musica.interfaces';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('300ms ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class LayoutComponent implements OnInit, OnDestroy {
  value = 75;
  selectedNavItem: string = 'music';
  currentTrack: SpotifyTrack | null = null;
  isPlaying = false;
  establecimientoId: number | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private playbackService: PlaybackService,
  ) {}

  async ngOnInit() {
    this.updateSelectedNavFromUrl();
    
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedNavFromUrl();
      });

    // Suscribirse al estado del reproductor
    this.playbackService.playbackState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.currentTrack = state.currentTrack;
        this.isPlaying = state.isPlaying;
        
        // Actualizar el valor del volumen en el slider
        this.value = Math.round(state.volume * 100);
        this.updateVolumeSlider();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateSelectedNavFromUrl() {
    const url = this.router.url;
    if (url.includes('/layout/music') || url === '/layout') {
      this.selectedNavItem = 'music';
    } else if (url.includes('/layout/ordenes')) {
      this.selectedNavItem = 'ordenes';
    } else if (url.includes('/layout/games')) {
      this.selectedNavItem = 'games';
    } else if (url.includes('/layout/settings')) {
      this.selectedNavItem = 'settings';
    }
  }

  async updateValue(event: Event) {
    const input = event.target as HTMLInputElement;
    const percent = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty('--value', percent + '%');
    
    // Actualizar el volumen en el servicio de playback
    const volume = +input.value / 100; // Convertir de 0-100 a 0-1
    await this.playbackService.setVolume(volume);
  }

  private updateVolumeSlider() {
    // Actualizar visualmente el slider de volumen
    setTimeout(() => {
      const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
      if (slider) {
        const percent = ((this.value - +slider.min) / (+slider.max - +slider.min)) * 100;
        slider.style.setProperty('--value', percent + '%');
      }
    }, 0);
  }

  selectNavItem(item: string) {
    this.selectedNavItem = item;
    this.router.navigate(['/layout', item]);
  }

  prepareRoute(outlet: RouterOutlet) {
    if (!outlet || !outlet.activatedRouteData) {
      return 'default';
    }
    return outlet.activatedRouteData['animation'] || 'default';
  }

  async togglePlay() {
    if (!this.currentTrack) {
      return;
    }

    await this.playbackService.togglePlay();
  }

  async nextTrack() {
    if (!this.currentTrack) {
      return;
    }

    await this.playbackService.nextTrack();
  }

  async previousTrack() {
    if (!this.currentTrack) {
      return;
    }

    await this.playbackService.previousTrack();
  }
}
