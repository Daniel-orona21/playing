import { Component, Input, Output, EventEmitter, AfterViewInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-canciones-categoria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canciones-categoria.component.html',
  styleUrl: './canciones-categoria.component.scss'
})
export class CancionesCategoriaComponent implements AfterViewInit {
  @Input() categoryName: string | null = null;
  @Output() backToCategories = new EventEmitter<void>();

  menuAbierto: number | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  @HostListener('document:click', ['$event']) onDocumentClick(event: Event) {
    if (this.menuAbierto !== null) {
      const clickedElement = event.target as HTMLElement;
      const menuButton = clickedElement.closest('.mas');
      const menuFlotante = clickedElement.closest('.menu-flotante');

      if (!menuButton && !menuFlotante) {
        this.menuAbierto = null;
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (!scroller) {
          console.warn("Scroller element not found for animations in CancionesCategoriaComponent.");
          return;
        }

        gsap.utils.toArray(".songs-grid .cancion").forEach((element: any) => {
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

  songs = [
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
    { title: 'Cancion 24', artist: 'Artista de prueba' },
  ];

  goBack() {
    this.backToCategories.emit();
  }

  abrirMenu(index: number, event: Event) {
    event.stopPropagation(); // Prevent the click from propagating to the song container
    this.menuAbierto = this.menuAbierto === index ? null : index;
  }

  eliminarCancion(index: number) {
    console.log('Eliminar canción:', index);
    this.menuAbierto = null; // Close the menu after action
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
