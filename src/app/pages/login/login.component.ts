import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Verificar si ya está autenticado
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['layout']);
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      console.log('Iniciando autenticación con Google...');
      await this.authService.loginWithGoogle();
      console.log('Autenticación exitosa, navegando...');
      // Solo navegar si la autenticación fue exitosa
      this.router.navigate(['layout']);
    } catch (error) {
      console.error('Error en login:', error);
      this.errorMessage = 'Error al iniciar sesión con Google. Verifica que el servidor esté corriendo.';
      // NO navegar si hay error
    } finally {
      this.isLoading = false;
    }
  }

  // Método temporal para desarrollo (sin autenticación)
  login() {
    // Simular autenticación exitosa para desarrollo
    const mockUser = {
      id: 1,
      nombre: 'Administrador',
      email: 'admin@test.com',
      roll: 'admin'
    };
    const mockToken = 'mock_jwt_token_' + Date.now();
    
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    this.router.navigate(['layout']);
  }
}
