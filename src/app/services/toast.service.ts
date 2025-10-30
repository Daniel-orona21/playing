import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'llamada';
  duration?: number;
  data?: any; // Para almacenar datos adicionales como id_llamada
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new Subject<Toast>();
  public toasts$ = this.toastSubject.asObservable();
  
  private removeToastSubject = new Subject<number>(); // Para eliminar toasts por id_llamada
  public removeToast$ = this.removeToastSubject.asObservable();

  show(message: string, type: Toast['type'] = 'info', duration = 60000, data?: any) {
    const id = this.generateId();
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      data
    };
    this.toastSubject.next(toast);
    return id;
  }

  showLlamada(nombre: string, mesa: string, id_llamada: number) {
    console.log('📢 ToastService.showLlamada llamado:', { nombre, mesa, id_llamada });
    return this.show(
      `Mesa ${mesa} llamando`,
      'llamada',
      60000,
      { id_llamada }
    );
  }

  success(message: string, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  warning(message: string, duration = 5000) {
    return this.show(message, 'warning', duration);
  }

  info(message: string, duration = 3000) {
    return this.show(message, 'info', duration);
  }

  // Cerrar toast por id_llamada
  closeByLlamadaId(id_llamada: number) {
    console.log('🗑️ ToastService: Cerrando toast para llamada', id_llamada);
    this.removeToastSubject.next(id_llamada);
  }

  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

