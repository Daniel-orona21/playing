import { Component, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { EstablecimientosService, Establecimiento, Mesa } from '../../../services/establecimientos.service';
import { io } from 'socket.io-client';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ajustes',
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.scss',
  animations: [
    trigger('scaleInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-50%) scale(0.9)' }),
        animate('160ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ opacity: 1, transform: 'translateY(-50%) scale(1)' }))
      ]),
      transition(':leave', [
        animate('120ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ opacity: 0, transform: 'translateY(-50%) scale(0.9)' }))
      ])
    ])
  ]
})
export class AjustesComponent implements OnInit {
  establecimiento: Establecimiento | null = null;
  form = { nombre: '', url_menu: '', ubicacion: '' };
  isEditingEst = false;
  mesas: Mesa[] = [];
  showQr = false; // no longer used for modal; kept for compatibility
  qrUrl: SafeUrl | null = null;
  openMesaId: string | number | null = null;
  tooltipSide: 'left' | 'right' = 'right';
  private socket: any;

  constructor(private authService: AuthService, private router: Router, private estService: EstablecimientosService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.estService.getMiEstablecimiento().subscribe({
      next: (res) => {
        this.establecimiento = res.establecimiento;
        if (this.establecimiento) {
          this.form = {
            nombre: this.establecimiento.nombre || '',
            url_menu: this.establecimiento.url_menu || '',
            ubicacion: this.establecimiento.ubicacion || ''
          };
          this.cargarMesas();
          // Socket para actualizar mesas en vivo
          const base = (environment.apiUrl as any).replace('/api','');
          this.socket = io(base, { transports: ['websocket'] });
          this.socket.emit('join_establecimiento', this.establecimiento.id_establecimiento);
          this.socket.on('establecimiento:mesas_actualizadas', () => this.cargarMesas());
        }
      }
    });
  }

  guardarEstablecimiento(): void {
    if (!this.isFormValid()) {
      return;
    }
    
    this.estService.upsertMiEstablecimiento(this.form).subscribe({
      next: (res) => {
        this.establecimiento = res.establecimiento;
        this.isEditingEst = false;
        this.cargarMesas();
      }
    });
  }

  editarEstablecimiento(): void {
  if (!this.isEditingEst && this.establecimiento) {
      this.form = {
        nombre: this.establecimiento.nombre || '',
        url_menu: this.establecimiento.url_menu || '',
        ubicacion: this.establecimiento.ubicacion || ''
      };
    }
    this.isEditingEst = !this.isEditingEst;
  }

  cancelarEdicion(): void {
    this.isEditingEst = false;
  }

  cargarMesas(): void {
    if (!this.establecimiento) return;
    this.estService.listMesas(this.establecimiento.id_establecimiento).subscribe({
      next: (res) => {
        this.mesas = res.mesas || [];
      }
    });
  }

  crearMesaAuto(): void {
    if (!this.establecimiento) return;
    const siguiente = (this.mesas.length ? Math.max(...this.mesas.map(m => parseInt(m.numero_mesa, 10) || 0)) : 0) + 1;
    const numero = String(siguiente);
    this.estService.createMesa(this.establecimiento.id_establecimiento, numero).subscribe({
      next: (res) => {
        // Enriquecer la mesa con QR inmediato para poder "Ver QR" sin recargar
        const apiRoot = environment.apiUrl;
        const base = apiRoot.endsWith('/api') ? apiRoot.slice(0, -4) : apiRoot;
        const qr_url = `${base}/establecimientos/mesas/${res.mesa.id_mesa}/qr`;
        const nuevaMesa = {
          ...res.mesa,
          status: (res.mesa as any).status || 'libre',
          qr_url,
          qr_png: res.qr_image
        } as Mesa;
        this.mesas = [...this.mesas, nuevaMesa].sort((a, b) => (parseInt(a.numero_mesa, 10) || 0) - (parseInt(b.numero_mesa, 10) || 0));
        // No abrimos modal automáticamente; el botón "Ver QR" ya funcionará con qr_png/qr_url
      }
    });
  }

  eliminarUltimaMesa(): void {
    if (!this.establecimiento || !this.mesas.length) return;
    this.estService.deleteLastMesa(this.establecimiento.id_establecimiento).subscribe({
      next: (res) => {
        this.mesas = this.mesas.filter(m => m.id_mesa !== res.deleted.id_mesa);
      },
      error: (err) => {
        const code = err?.error?.error;
        if (code === 'mesa_ocupada') {
          alert('No se puede eliminar: hay un usuario asignado a esta mesa.');
        } else {
          alert('No se pudo eliminar la mesa.');
        }
      }
    });
  }

  verQr(url: string): void {
    if (!url) return;
    const withBuster = url.startsWith('data:') ? url : `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    this.qrUrl = this.sanitizer.bypassSecurityTrustUrl(withBuster);
    // For tooltip flow we do not set modal flag
  }

  cerrarQr(): void {
    this.openMesaId = null;
    this.qrUrl = null;
  }

  verQrMesa(mesa: Mesa): void {
    let candidate = mesa.qr_png || mesa.qr_url || '';
    if (!candidate) {
      // Fallback: construir URL del endpoint usando environment.apiUrl
      const apiRoot = environment.apiUrl; // p.ej. https://host/api
      const base = apiRoot.endsWith('/api') ? apiRoot.slice(0, -4) : apiRoot;
      candidate = `${base}/establecimientos/mesas/${mesa.id_mesa}/qr`;
    }
    if (!candidate) {
      console.warn('Mesa sin QR disponible', mesa);
      return;
    }
    this.verQr(candidate);
  }

  toggleQrTooltip(event: Event, mesa: Mesa, anchorEl?: HTMLElement): void {
    event.stopPropagation();
    if (this.openMesaId === mesa.id_mesa) {
      this.cerrarQr();
      return;
    }
    this.openMesaId = mesa.id_mesa as any;
    // Decide side: prefer right, fallback to left if not enough space
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const estimatedWidth = 240; // tooltip + arrow
      const spaceRight = viewportW - rect.right;
      const spaceLeft = rect.left;
      this.tooltipSide = spaceRight >= estimatedWidth || spaceRight > spaceLeft ? 'right' : 'left';
    } else {
      this.tooltipSide = 'right';
    }
    this.verQrMesa(mesa);
  }

  // Cerrar al hacer click fuera
  ngAfterViewInit(): void {
    document.addEventListener('click', this.handleOutsideClick);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleOutsideClick);
    if (this.socket) {
      try { this.socket.disconnect?.(); } catch {}
    }
  }

  private handleOutsideClick = () => {
    if (this.openMesaId !== null) {
      this.cerrarQr();
    }
  };

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getInitials(): string {
    if (this.establecimiento?.nombre) {
      return this.establecimiento.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    const user = this.authService.getCurrentUser();
    if (user?.nombre) {
      return user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    return 'A';
  }

  getDisplayName(): string {
    if (this.establecimiento?.nombre) {
      return this.establecimiento.nombre;
    }
    const user = this.authService.getCurrentUser();
    if (user?.nombre) {
      return user.nombre;
    }
    return 'Administrador';
  }

  isFormValid(): boolean {
  return !!(
    this.form.nombre?.trim().length &&
    this.form.ubicacion?.trim().length &&
    this.form.url_menu?.trim().length
  );
}
}
