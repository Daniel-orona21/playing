import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MusicaSocketService {
  private socket: Socket | null = null;
  private establecimientoId: number | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor() {}

  /**
   * Conectar al servidor de Socket.IO y unirse a la sala del establecimiento
   * @param establecimientoId - ID del establecimiento
   */
  connect(establecimientoId: number): void {
    if (this.socket && this.establecimientoId === establecimientoId) {
      console.log('🔌 Ya conectado al establecimiento:', establecimientoId);
      return;
    }

    console.log('🔌 Conectando a Socket.IO para establecimiento:', establecimientoId);
    
    // Desconectar socket anterior si existe
    if (this.socket) {
      this.disconnect();
    }

    this.establecimientoId = establecimientoId;
    
    // Obtener la URL base del API sin '/api'
    const baseUrl = environment.apiUrl.replace('/api', '');
    
    // Crear conexión de socket
    this.socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Event handlers
    this.socket.on('connect', () => {
      console.log('✅ Socket conectado:', this.socket?.id);
      // Unirse a la sala del establecimiento
      this.socket?.emit('join_establecimiento', establecimientoId);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket desconectado');
    });

    this.socket.on('connect_error', (error: any) => {
      console.log('❌ Error de conexión:', error);
    });

    // Eventos de reproducción (para logs, pero el backend emitirá estos eventos)
    this.socket.on('playback_update', (data: any) => {
      // console.log('🎵 Actualización de reproducción (confirmación):', data);
    });

    this.socket.on('queue_update', (data: any) => {
      console.log('📋 Actualización de cola (confirmación):', data);
      // Disparar evento window para que los componentes se actualicen
      window.dispatchEvent(new CustomEvent('queueUpdated'));
    });

    this.socket.on('history_update', (data: any) => {
      console.log('📜 Actualización de historial (confirmación):', data);
      // Disparar evento window para que los componentes se actualicen
      window.dispatchEvent(new CustomEvent('historyUpdated'));
    });

    // Setup listeners for custom event handlers
    this.setupCustomEventHandlers();
  }

  /**
   * Setup custom event handlers
   */
  private setupCustomEventHandlers(): void {
    if (!this.socket) return;

    // Listen for all possible events and call registered handlers
    const events = ['playback_update', 'track_started', 'playback_state_change', 'playback_progress', 'queue_update', 'history_update'];
    
    events.forEach(eventName => {
      this.socket!.on(eventName, (data: any) => {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
          listeners.forEach(callback => callback(data));
        }
      });
    });
  }

  /**
   * Subscribe to a socket event
   * @param eventName - Name of the event to listen to
   * @param callback - Callback function to execute when event is received
   * @returns Unsubscribe function
   */
  on(eventName: string, callback: Function): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    
    this.eventListeners.get(eventName)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventName);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Desconectar del servidor de Socket.IO
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Desconectando socket...');
      this.socket.disconnect();
      this.socket = null;
      this.establecimientoId = null;
      this.eventListeners.clear();
    }
  }

  /**
   * Emitir un evento de actualización de estado de reproducción
   * @param establecimientoId - ID del establecimiento
   * @param isPlaying - Estado de reproducción
   * @param position - Posición actual en ms
   */
  emitPlaybackStateChange(establecimientoId: number, isPlaying: boolean, position: number): void {
    console.log('📡 [Admin] Emitiendo cambio de estado:', { isPlaying, position });
    // El socket emite indirectamente a través del backend
    // No es necesario emitir directamente desde aquí
  }

  /**
   * Verificar si está conectado
   * @returns boolean
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  /**
   * Obtener ID del establecimiento actual
   * @returns number | null
   */
  getEstablecimientoId(): number | null {
    return this.establecimientoId;
  }
}

