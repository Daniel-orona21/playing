import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { ListaComponent } from './vistas/lista/lista.component';
import { BusquedaComponent } from './vistas/busqueda/busqueda.component';
import { FiltroComponent } from './vistas/filtro/filtro.component';

@Component({
  selector: 'app-musica',
  standalone: true,
  imports: [CommonModule, ListaComponent, BusquedaComponent, FiltroComponent],
  templateUrl: './musica.component.html',
  styleUrl: './musica.component.scss'
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
    // Ya no navegamos, solo cambiamos el tab
    // Opcional: actualizar la URL sin navegar
    this.router.navigate(['/layout/music', tab], { skipLocationChange: false });
  }
}
