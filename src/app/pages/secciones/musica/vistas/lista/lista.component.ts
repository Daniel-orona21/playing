import { Component, HostListener, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface Cancion {
  id: number;
  nombre: string;
  artista: string;
  duracion?: string;
  album?: string;
  year?: number;
}

@Component({
  selector: 'app-lista',
  imports: [CommonModule],
  templateUrl: './lista.component.html',
  styleUrl: './lista.component.scss'
})
export class ListaComponent implements AfterViewInit{

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);

    if (isPlatformBrowser(this.platformId)) {
      this._setupContinuacionAnimations();
      this._setupHistorialAnimations();
    }
  }

  private _setupContinuacionAnimations(): void {
    const scroller = document.querySelector(".side.continuacion .canciones");
    if (!scroller) return;

    gsap.utils.toArray(".side.continuacion .canciones .cancion").forEach((element: any) => {
      if (!this._isElementInScrollerViewport(element, scroller as HTMLElement)) {
        gsap.set(element, { opacity: 0, y: 0, scale: 0.65 });
      }
      gsap.to(element,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            scroller: scroller,
            start: "top 95%",
            toggleActions: "play none none reverse",
          }
        }
      );
    });
  }

  private _setupHistorialAnimations(): void {
    const scroller = document.querySelector(".side.historial .canciones");
    if (!scroller) return;

    gsap.utils.toArray(".side.historial .canciones .cancion").forEach((element: any) => {
      if (!this._isElementInScrollerViewport(element, scroller as HTMLElement)) {
        gsap.set(element, { opacity: 0, y: 0, scale: 0.65 });
      }
      gsap.to(element,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            scroller: scroller,
            start: "top 95%",
            toggleActions: "play none none reverse",
          }
        }
      );
    });
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

  aContinuacion: Cancion[] = [
    { id: 1, nombre: 'Cancion 24', artista: 'Artista de prueba', duracion: '3:45', album: 'Album 1', year: 2024 },
    { id: 2, nombre: 'Cancion 25', artista: 'Artista de prueba', duracion: '4:12', album: 'Album 1', year: 2024 },
    { id: 3, nombre: 'Cancion 26', artista: 'Artista de prueba', duracion: '3:28', album: 'Album 2', year: 2024 },
    { id: 4, nombre: 'Cancion 27', artista: 'Artista de prueba', duracion: '4:33', album: 'Album 2', year: 2024 },
    { id: 5, nombre: 'Cancion 28', artista: 'Artista de prueba', duracion: '3:15', album: 'Album 3', year: 2024 },
    { id: 6, nombre: 'Cancion 29', artista: 'Artista de prueba', duracion: '4:01', album: 'Album 3', year: 2024 },
    { id: 7, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 },
    { id: 7, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 },
    { id: 7, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 },
    { id: 7, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 },
    { id: 7, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 },
    { id: 7, nombre: 'Cancion 30', artista: 'Artista de prueba', duracion: '3:52', album: 'Album 4', year: 2024 }
  ];

  historial: Cancion[] = [
    { id: 8, nombre: 'Cancion 17', artista: 'Artista de prueba', duracion: '3:20', album: 'Album 1', year: 2024 },
    { id: 9, nombre: 'Cancion 18', artista: 'Artista de prueba', duracion: '4:05', album: 'Album 1', year: 2024 },
    { id: 10, nombre: 'Cancion 19', artista: 'Artista de prueba', duracion: '3:45', album: 'Album 2', year: 2024 },
    { id: 11, nombre: 'Cancion 20', artista: 'Artista de prueba', duracion: '3:38', album: 'Album 2', year: 2024 },
    { id: 12, nombre: 'Cancion 21', artista: 'Artista de prueba', duracion: '4:15', album: 'Album 3', year: 2024 },
    { id: 13, nombre: 'Cancion 22', artista: 'Artista de prueba', duracion: '3:30', album: 'Album 3', year: 2024 },
    { id: 14, nombre: 'Cancion 23', artista: 'Artista de prueba', duracion: '3:55', album: 'Album 4', year: 2024 }
  ];

  menuAbierto: number | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  eliminarCancion(index: number) {
    const cancionElement = document.querySelector(`.side.continuacion .canciones .cancion:nth-child(${index + 1})`) as HTMLElement;
    if (cancionElement) {
      gsap.to(cancionElement, {
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        duration: 0.3,
        ease: "power1.out",
        onComplete: () => {
          this.aContinuacion.splice(index, 1);
          this.menuAbierto = null;
          ScrollTrigger.refresh();
          console.log('ScrollTrigger refreshed after animated deletion.');
        }
      });
    } else {
      this.aContinuacion.splice(index, 1);
      this.menuAbierto = null;
      ScrollTrigger.refresh();
      console.log('ScrollTrigger refreshed after direct deletion (element not found).');
    }
  }

  abrirMenu(index: number, event: Event) {
    event.stopPropagation();
    this.menuAbierto = this.menuAbierto === index ? null : index;
  }

  cerrarMenu() {
    this.menuAbierto = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.menuAbierto !== null) {
      this.cerrarMenu();
    }
  }
}
