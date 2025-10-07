import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ordenes-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './ordenes-layout.component.html',
  styleUrl: './ordenes-layout.component.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('300ms ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class OrdenesLayoutComponent implements OnInit {
  selectedTab: string = 'ordenes';

  constructor(private router: Router) {}

  ngOnInit() {
    this.updateSelectedTabFromUrl();
    
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedTabFromUrl();
      });
  }

  private updateSelectedTabFromUrl() {
    const url = this.router.url;
    if (url.includes('/layout/ordenes/ordenes') || url === '/layout/ordenes') {
      this.selectedTab = 'ordenes';
    } else if (url.includes('/layout/ordenes/usuarios')) {
      this.selectedTab = 'usuarios';
    }
  }

  selectTab(tab: string) {
    this.selectedTab = tab;
    this.router.navigate(['/layout/ordenes', tab]);
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }
}
