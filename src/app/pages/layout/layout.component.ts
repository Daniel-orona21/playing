import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-layout',
  imports: [CommonModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  public pause = false;
  value = 50;
  selectedNavItem: string | 'music' = 'music';


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
  }
}
