import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CancionesCategoriaComponent } from "./canciones-categoria/canciones-categoria.component";
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [CommonModule, CancionesCategoriaComponent],
  templateUrl: './busqueda.component.html',
  styleUrl: './busqueda.component.scss'
})
export class BusquedaComponent implements AfterViewInit {

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.selectedCategory) {
        this._setupCategoryAnimations();
      }
    }
  }

  private _setupCategoryAnimations(): void {
    // Kill existing ScrollTriggers for .celda elements to prevent duplicates
    ScrollTrigger.getAll().forEach(st => {
      if (st.trigger && (st.trigger as HTMLElement).classList.contains('celda')) {
        st.kill();
      }
    });

    setTimeout(() => {
      const scroller = document.querySelector(".scroll");
      if (!scroller) {
        console.warn("Scroller element not found for animations.");
        return;
      }

      gsap.utils.toArray(".celda").forEach((element: any) => {
        if (!this._isElementInScrollerViewport(element, scroller as HTMLElement)) {
          gsap.set(element, { opacity: 0, scale: 0.65 }); // Set initial state only if not in viewport
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
              start: "top 90%",
              toggleActions: "play none none reverse",
            }
          }
        );
      });
      ScrollTrigger.refresh();
    }, 0);
  }

  generosMusicales = [
    { nombre: 'Hip-Hop/Rap', backgroundColor: 'color.adjust($contenedor, $lightness: -5%)' },
    { nombre: 'Dance', backgroundColor: 'color.adjust($contenedor, $lightness: +20%)' },
    { nombre: 'Rock', backgroundColor: '$contenedor' },
    { nombre: 'Pop', backgroundColor: 'color.adjust($contenedor, $lightness: +40%)' },
    { nombre: 'House', backgroundColor: '$contenedor' },
    { nombre: 'Reggaeton', backgroundColor: '$contenedor' },
    { nombre: 'Regional', backgroundColor: '$contenedor' },
    { nombre: 'Electronic', backgroundColor: 'color.adjust($contenedor, $lightness: +10%)' },
    { nombre: 'Jazz', backgroundColor: 'color.adjust($contenedor, $lightness: +30%)' },
    { nombre: 'Regional', backgroundColor: '$contenedor' },
    { nombre: 'Electronic', backgroundColor: 'color.adjust($contenedor, $lightness: +10%)' },
    { nombre: 'Jazz', backgroundColor: 'color.adjust($contenedor, $lightness: +30%)' },
    { nombre: 'Regional', backgroundColor: '$contenedor' },
    { nombre: 'Electronic', backgroundColor: 'color.adjust($contenedor, $lightness: +10%)' },
    { nombre: 'Electronic', backgroundColor: 'color.adjust($contenedor, $lightness: +10%)' },
    { nombre: 'Jazz', backgroundColor: 'color.adjust($contenedor, $lightness: +30%)' },
    { nombre: 'Regional', backgroundColor: '$contenedor' },
    { nombre: 'Electronic', backgroundColor: 'color.adjust($contenedor, $lightness: +10%)' },
    { nombre: 'Jazz', backgroundColor: 'color.adjust($contenedor, $lightness: +30%)' }
  ];

  selectedCategory: string | null = null;

  selectCategory(category: string) {
    this.selectedCategory = category;
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (scroller) {
          scroller.scrollTop = 0; // Reset scroll position to top when selecting a category
        }
      }, 0);
    }
  }

  clearCategory() {
    this.selectedCategory = null;
    if (isPlatformBrowser(this.platformId)) {
      // Give Angular time to re-render the *ngIf content
      setTimeout(() => {
        const scroller = document.querySelector(".scroll");
        if (scroller) {
          scroller.scrollTop = 0; // Reset scroll position to top when returning to categories
        }
        this._setupCategoryAnimations();
      }, 0);
    }
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
