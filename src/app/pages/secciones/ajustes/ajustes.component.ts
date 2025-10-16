import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { EstablecimientosService, Establecimiento } from '../../../services/establecimientos.service';

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

  constructor(private authService: AuthService, private router: Router, private estService: EstablecimientosService) {}

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
        }
      }
    });
  }

  guardarEstablecimiento(): void {
    this.estService.upsertMiEstablecimiento(this.form).subscribe({
      next: (res) => {
        this.establecimiento = res.establecimiento;
        this.isEditingEst = false;
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

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
