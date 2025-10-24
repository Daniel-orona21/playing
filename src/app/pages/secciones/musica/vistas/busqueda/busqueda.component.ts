import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FormsModule } from '@angular/forms'; // Import FormsModule

import { SpotifyService } from '../../../../../services/spotify.service';
import { SearchResultsComponent } from './search-results/search-results.component';
import { CancionesCategoriaComponent } from './canciones-categoria/canciones-categoria.component';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [CommonModule, CancionesCategoriaComponent, FormsModule, SearchResultsComponent],
  providers: [SpotifyService],
  templateUrl: './busqueda.component.html',
  styleUrl: './busqueda.component.scss'
})
export class BusquedaComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() hidden: boolean = false;
  private animationsInitialized = false;

  searchTerm: string = ''; 
  generosMusicales: any[] = [];
  loading = true;
  private searchTimeout: any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private spotifyService: SpotifyService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Detectar cuando el componente se vuelve visible
    if (changes['hidden'] && !changes['hidden'].currentValue && changes['hidden'].previousValue) {
      // El componente acaba de volverse visible
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this._refreshAnimations();
        }, 100);
      }
    }
  }

  async ngOnInit() {
    await this.loadGenres();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (!this.hidden && !this.selectedCategory) {
          this._setupCategoryAnimations();
          this.animationsInitialized = true;
        }
      }, 100);
    }
  }

  private _refreshAnimations(): void {
    console.log('🔄 Refreshing busqueda animations');
    
    if (!this.selectedCategory && this.generosMusicales.length > 0) {
      this._setupCategoryAnimations();
    }
  }

  limpiarBuscador(){
    this.searchTerm= '';
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

  async loadGenres() {
    try {
      this.loading = true;
      const response = await this.spotifyService.getGenres().toPromise();
      if (response?.success) {
        this.generosMusicales = response.genres.map((genre: string) => ({
          nombre: genre.charAt(0).toUpperCase() + genre.slice(1),
          backgroundColor: this.getRandomBackgroundColor()
        }));
      }
    } catch (error) {
      console.error('Error loading genres:', error);
    } finally {
      this.loading = false;
    }
  }

  private getRandomBackgroundColor(): string {
    const colors = [
      'color.adjust($contenedor, $lightness: -5%)',
      'color.adjust($contenedor, $lightness: +20%)',
      '$contenedor',
      'color.adjust($contenedor, $lightness: +40%)',
      'color.adjust($contenedor, $lightness: +10%)',
      'color.adjust($contenedor, $lightness: +30%)'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

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

  onSearchChange() {
    console.log('Search term changed:', this.searchTerm);
    
    // Limpiar timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Si hay término de búsqueda, limpiar categoría seleccionada
    if (this.searchTerm.trim().length > 0) {
      this.selectedCategory = null;
      
      // Debounce: esperar 500ms antes de hacer la búsqueda
      this.searchTimeout = setTimeout(() => {
        console.log('Executing search for:', this.searchTerm);
      }, 500);
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
