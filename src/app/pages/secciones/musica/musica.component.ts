import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';
import { SpotifyService } from '../../../services/spotify.service';

@Component({
  selector: 'app-musica',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './musica.component.html',
  styleUrl: './musica.component.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('300ms ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class MusicaComponent implements OnInit, OnDestroy {
  selectedTab: string = 'lista';
  showSpotifyInstructions = false;

  constructor(private router: Router, private spotifyService: SpotifyService) {}

  ngOnInit() {
    // Establecer el tab inicial basado en la URL actual
    this.updateSelectedTabFromUrl();
    
    // Detectar cambios en la ruta para actualizar el tab seleccionado
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedTabFromUrl();
      });

    // Escuchar evento para mostrar instrucciones de Spotify
    window.addEventListener('showSpotifyInstructions', () => {
      this.showInstructions();
    });
  }

  private updateSelectedTabFromUrl() {
    const url = this.router.url;
    if (url.includes('/layout/music/lista') || url === '/layout/music') {
      this.selectedTab = 'lista';
    } else if (url.includes('/layout/music/busqueda')) {
      this.selectedTab = 'busqueda';
    } else if (url.includes('/layout/music/filtro')) {
      this.selectedTab = 'filtro';
    }
  }

  selectTab(tab: string) {
    this.selectedTab = tab;
    this.router.navigate(['/layout/music', tab]);
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }

  showInstructions() {
    this.showSpotifyInstructions = true;
  }

  hideInstructions() {
    this.showSpotifyInstructions = false;
  }

  ngOnDestroy() {
    window.removeEventListener('showSpotifyInstructions', () => {
      this.showInstructions();
    });
  }
}
