import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent implements OnInit {
  public pause = false;
  value = 50;
  selectedNavItem: string = 'music';

  constructor(private router: Router) {}

  ngOnInit() {
    // Establecer la ruta inicial basada en la URL actual
    this.updateSelectedNavFromUrl();
    
    // Detectar cambios en la ruta para actualizar el botón seleccionado
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedNavFromUrl();
      });
  }

  private updateSelectedNavFromUrl() {
    const url = this.router.url;
    if (url.includes('/layout/music') || url === '/layout') {
      this.selectedNavItem = 'music';
    } else if (url.includes('/layout/playlist')) {
      this.selectedNavItem = 'playlist';
    } else if (url.includes('/layout/games')) {
      this.selectedNavItem = 'games';
    } else if (url.includes('/layout/settings')) {
      this.selectedNavItem = 'settings';
    }
  }

  play() {
    this.pause = !this.pause;
  }

  updateValue(event: Event) {
    const input = event.target as HTMLInputElement;
    const percent = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty('--value', percent + '%');
  }

  selectNavItem(item: string) {
    this.selectedNavItem = item;
    this.router.navigate(['/layout', item]);
  }
}
