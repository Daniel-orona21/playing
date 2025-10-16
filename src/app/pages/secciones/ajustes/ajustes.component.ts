import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { EstablecimientosService, Establecimiento, Mesa } from '../../../services/establecimientos.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ajustes',
  imports: [CommonModule, FormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.scss'
})
export class AjustesComponent implements OnInit {
  establecimiento: Establecimiento | null = null;
  form = { nombre: '', url_menu: '', ubicacion: '' };
  isEditingEst = false;
  mesas: Mesa[] = [];
  showQr = false;
  qrUrl: SafeUrl | null = null;

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
        }
      }
    });
  }

  guardarEstablecimiento(): void {
    this.estService.upsertMiEstablecimiento(this.form).subscribe({
      next: (res) => {
        this.establecimiento = res.establecimiento;
        this.isEditingEst = false;
        this.cargarMesas();
      }
    });
  }

  editarEstablecimiento(): void {
    if (this.establecimiento) {
      this.form = {
        nombre: this.establecimiento.nombre || '',
        url_menu: this.establecimiento.url_menu || '',
        ubicacion: this.establecimiento.ubicacion || ''
      };
    }
    this.isEditingEst = true;
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
      }
    });
  }

  verQr(url: string): void {
    if (!url) return;
    const withBuster = url.startsWith('data:') ? url : `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    this.qrUrl = this.sanitizer.bypassSecurityTrustUrl(withBuster);
    this.showQr = true;
  }

  cerrarQr(): void {
    this.showQr = false;
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

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
