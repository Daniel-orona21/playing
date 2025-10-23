import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-musica',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
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
export class MusicaComponent implements OnInit {
  selectedTab: string = 'lista';
  showSpotifyInstructions = false;

  constructor(private router: Router) {}

  ngOnInit() {
    // Establecer el tab inicial basado en la URL actual
    this.updateSelectedTabFromUrl();
    
    // Detectar cambios en la ruta para actualizar el tab seleccionado
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedTabFromUrl();
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
}
