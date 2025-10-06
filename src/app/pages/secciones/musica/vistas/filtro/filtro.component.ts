import { Component, Input, Output, EventEmitter, AfterViewInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-filtro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filtro.component.html',
  styleUrl: './filtro.component.scss'
})
export class FiltroComponent implements AfterViewInit {

  @Input() categoryName: string | null = null;
  @Output() backToCategories = new EventEmitter<void>();

  menuAbierto: {song: number | null, genre: number | null, artist: number | null} = {song: null, genre: null, artist: null};
  userSongLimit: number = 5;
  playLimit: string = '1_hour'; // '1_hour', '2_hours', 'no_limit'
  showConfirmModal: boolean = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  @HostListener('document:click', ['$event']) onDocumentClick(event: Event) {
    if (this.menuAbierto.song !== null || this.menuAbierto.genre !== null || this.menuAbierto.artist !== null) {
      const clickedElement = event.target as HTMLElement;
      const menuButton = clickedElement.closest('.mas');
      const menuFlotante = clickedElement.closest('.menu-flotante');

      if (!menuButton && !menuFlotante) {
        this.menuAbierto = {song: null, genre: null, artist: null};
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (!scroller) {
          console.warn("Scroller element not found for animations in FiltroComponent.");
          return;
        }

        gsap.utils.toArray(".filtro-grid .item").forEach((element: any) => {
          if (!this._isElementInScrollerViewport(element, scroller as HTMLElement)) {
            gsap.set(element, { opacity: 0, scale: 0.65 });
          }
          gsap.to(element,
            {
              opacity: 1,
              scale: 1,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: {
                trigger: element,
                scroller: scroller,
                start: "top 100%",
                toggleActions: "play none none reverse",
              }
            }
          );
        });
        ScrollTrigger.refresh();
      }, 0);
    }
  }

  incrementUserSongLimit() {
    this.userSongLimit++;
  }

  decrementUserSongLimit() {
    if (this.userSongLimit > 0) {
      this.userSongLimit--;
    }
  }

  songs = [
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
  ];

  genres = [
    { name: 'Género' },
    { name: 'Género' },
    { name: 'Género' },
  ];

  artists = [
    { name: 'Artista' },
    { name: 'Artista' },
    { name: 'Artista' },
  ];

  goBack() {
    this.backToCategories.emit();
  }

  abrirMenu(index: number, event: Event, type: 'song' | 'genre' | 'artist') {
    event.stopPropagation();
    // Close other menus if open
    for (const key in this.menuAbierto) {
      if (key !== type) {
        (this.menuAbierto as any)[key] = null;
      }
    }
    (this.menuAbierto as any)[type] = (this.menuAbierto as any)[type] === index ? null : index;
  }

  eliminarItem(index: number, type: 'cancion' | 'genero' | 'artista') {
    if (type === 'cancion') {
      this.songs.splice(index, 1);
    } else if (type === 'genero') {
      this.genres.splice(index, 1);
    } else if (type === 'artista') {
      this.artists.splice(index, 1);
    }
    this.menuAbierto = {song: null, genre: null, artist: null}; // Close all menus after action
  }

  clearAllFilters() {
    this.showConfirmModal = true;
  }

  confirmClearFilters() {
    this.songs = [];
    this.genres = [];
    this.artists = [];
    this.playLimit = 'no_limit';
    this.userSongLimit = 0;
    this.menuAbierto = {song: null, genre: null, artist: null};
    this.showConfirmModal = false; // Close modal after clearing
  }

  cancelClearFilters() {
    this.showConfirmModal = false; // Close modal without clearing
  }

  private _isElementInScrollerViewport(element: HTMLElement, scroller: Element, threshold: number = 0): boolean {
    const scrollerRect = scroller.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    return (
      elementRect.top >= scrollerRect.top - (scrollerRect.height * threshold) &&
      elementRect.left >= scrollerRect.left - (scrollerRect.width * threshold) &&
      elementRect.bottom <= scrollerRect.bottom + (scrollerRect.height * threshold) &&
      elementRect.right <= scrollerRect.right + (scrollerRect.width * threshold)
    );
  }

}
