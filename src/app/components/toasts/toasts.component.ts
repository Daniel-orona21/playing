import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';
import { LlamadasService } from '../../services/llamadas.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div 
        *ngFor="let toast of toasts" 
        class="toast"
        [class.toast-success]="toast.type === 'success'"
        [class.toast-error]="toast.type === 'error'"
        [class.toast-warning]="toast.type === 'warning'"
        [class.toast-info]="toast.type === 'info'"
        [class.toast-llamada]="toast.type === 'llamada'">
        
        <div class="toast-content">
          <div class="led"></div>
          <p class="toast-message">{{ toast.message }}</p>
        </div>
        
        <div class="toast-actions">
          <button 
            *ngIf="toast.type === 'llamada'" 
            class="toast-btn toast-btn-primary"
            (click)="atenderLlamada(toast)">
            <span class="material-symbols-outlined ok">check_circle</span>
          </button>
          <button 
            class="toast-btn toast-btn-secondary"
            (click)="removeToast(toast.id)">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
    }

    .toast {
      background: white;
      border-radius: 99px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-success {
      border-left-color: #10b981;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, white 100%);
    }

    .toast-error {
      border-left-color: #ef4444;
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, white 100%);
    }

    .toast-warning {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, white 100%);
    }

    .toast-info {
      border-left-color: #3b82f6;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, white 100%);
    }

    .toast-llamada {
      background-color: #212121ff;
    }


    .toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

      .led {
    width: 10px;
    aspect-ratio: 1;
    height: 10px;
    border-radius: 99px;
    display: flex;
    background-color: #2CDC6E;
    animation: led 2s ease-in-out infinite;
  }

  @keyframes led {
  0%, 10%, 20%, 30%, 100% { opacity: .2; }
  5%, 15%, 25% { opacity: 1; }
  40%, 100% { opacity: .2; }
}

    .toast-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .toast-success .toast-icon {
      color: #10b981;
    }

    .toast-error .toast-icon {
      color: #ef4444;
    }

    .toast-warning .toast-icon,
    .toast-llamada .toast-icon {
      color: #f59e0b;
      animation: bell-ring 1.5s ease-in-out infinite;
    }

    @keyframes bell-ring {
      0%, 100% {
        transform: rotate(0deg);
      }
      10%, 30% {
        transform: rotate(-10deg);
      }
      20%, 40% {
        transform: rotate(10deg);
      }
      50% {
        transform: rotate(0deg);
      }
    }

    .toast-info  {
      color: white;
    }

    .toast-message {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: white;
      line-height: 1.4;
    }

    .toast-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .toast-btn {
      border: none;
      border-radius: 99px;
      padding: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;

    }

    .ok {
      color: #2CDC6E
    }

    .toast-btn-primary {
      background: transparent;
      color: white;
    }

    .toast-btn-primary:hover {
      background: #fefefe14;
    }

    .toast-btn-secondary {
      background: transparent;
      color: #6b7280;
      padding: 4px;
    }

    .toast-btn-secondary:hover {
      color: white;
    }

    .toast-btn .material-symbols-outlined {
      font-size: 18px;
    }

    @media (max-width: 640px) {
      .toast-container {
        right: 10px;
        left: 10px;
        max-width: none;
      }

      .toast {
        padding: 12px;
      }

      .toast-message {
        font-size: 13px;
      }
    }
  `]
})
export class ToastsComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subscription: Subscription = new Subscription();
  private timers: Map<string, any> = new Map();

  constructor(
    private toastService: ToastService,
    private llamadasService: LlamadasService
  ) {}

  ngOnInit() {
    console.log('🍞 ToastsComponent inicializado');
    this.subscription.add(
      this.toastService.toasts$.subscribe(toast => {
        console.log('🍞 Toast recibido:', toast);
        this.toasts.push(toast);
        
        if (toast.duration && toast.duration > 0) {
          const timer = setTimeout(() => {
            this.removeToast(toast.id);
          }, toast.duration);
          this.timers.set(toast.id, timer);
        }
      })
    );
    
    // Escuchar cuando se debe cerrar un toast por id_llamada
    this.subscription.add(
      this.toastService.removeToast$.subscribe(id_llamada => {
        console.log('🗑️ ToastsComponent: Buscando toast con llamada', id_llamada);
        const toastToRemove = this.toasts.find(t => t.data?.id_llamada === id_llamada);
        if (toastToRemove) {
          console.log('✅ Toast encontrado, eliminando:', toastToRemove.id);
          this.removeToast(toastToRemove.id);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  removeToast(id: string) {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index > -1) {
      this.toasts.splice(index, 1);
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
    }
  }

  atenderLlamada(toast: Toast) {
    if (toast.data?.id_llamada) {
      this.llamadasService.marcarLlamadaAtendida(toast.data.id_llamada).subscribe({
        next: () => {
          this.removeToast(toast.id);
          // this.toastService.success('Llamada atendida');
        },
        error: (error) => {
          console.error('Error al atender llamada:', error);
          this.toastService.error('Error al atender la llamada');
        }
      });
    }
  }

  getIcon(type: string): string {
    const icons: { [key: string]: string } = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info',
      llamada: 'notifications_active'
    };
    return icons[type] || 'info';
  }
}

