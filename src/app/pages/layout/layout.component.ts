import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';

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
export class LayoutComponent implements OnInit {
  public pause = false;
  value = 75;
  selectedNavItem: string = 'music';

  constructor(private router: Router) {}

  ngOnInit() {
    this.updateSelectedNavFromUrl();
    
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

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }
}
