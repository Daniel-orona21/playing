import { CommonModule } from '@angular/common';
import { Component, Renderer2, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdenesService, Orden, UsuarioActivo } from '../../../../services/ordenes.service';
import { EstablecimientosService } from '../../../../services/establecimientos.service';
import { Subscription } from 'rxjs';

interface Order {
  id: number;
  mesa: number;
  usuario: string;
  estado: string;
  monto: number;
  tiempoEspera: number;
  numeroOrden: string;
  total: number;
  fechaCreacion: Date;
  tiempoOriginal: number;
}

interface NewOrder {
  id: number;
  numeroOrden: string;
  total: number | null;
  tiempoEspera: number | null;
  usuario: string;
  mesa: number;
  estado: string;
  monto: number;
}

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss'
})
export class OrdenesComponent implements OnInit, OnDestroy {
  isModalVisible = false;
  selectedUser: any = null;
  modalAction = '';
  isUserSelectionModalVisible: boolean = false;
  newOrder: NewOrder = { id: 0, numeroOrden: '', total: null, tiempoEspera: null, usuario: '', mesa: 0, estado: 'En proceso', monto: 0 };
  currentStep: number = 1;
  establecimientoId: number = 0;
  loading: boolean = false;
  private subscriptions: Subscription = new Subscription();
  private timerInterval: any;
  
  // Variables de validación
  totalInvalid: boolean = false;
  tiempoInvalid: boolean = false;

  constructor(
    private renderer: Renderer2,
    private ordenesService: OrdenesService,
    private establecimientosService: EstablecimientosService
  ) {}
  estatus = [
    { label: 'En preparación', active: false, value: 'En preparación' },
    { label: 'Entregada', active: false, value: 'Entregada' },
    { label: 'Todas', active: true, value: 'todos' },
  ];

  deletionMode: boolean = false;
  selectedOrders: Order[] = [];

  users: any[] = [];
  orders: Order[] = [];

  searchTerm: string = '';
  sortBy: keyof Order = 'numeroOrden'; 
  sortDirection: 'asc' | 'desc' = 'asc'; 

  ngOnInit(): void {
    this.loading = true;
    this.establecimientosService.getMiEstablecimiento().subscribe({
      next: (response) => {
        if (response.success && response.establecimiento) {
          this.establecimientoId = response.establecimiento.id_establecimiento;
          this.loadOrdenes();
        } else {
          console.error('No se encontró establecimiento para el usuario');
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('Error al obtener establecimiento:', error);
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  loadOrdenes(): void {
    this.loading = true;
    this.ordenesService.getOrdenes(this.establecimientoId).subscribe({
      next: (response) => {
        if (response.success) {
          this.orders = response.ordenes.map(orden => this.mapOrdenToOrder(orden));
          this.startTimer();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar órdenes:', error);
        this.loading = false;
      }
    });
  }

  loadUsuariosActivos(): void {
    this.loading = true;
    this.ordenesService.getUsuariosActivos(this.establecimientoId).subscribe({
      next: (response) => {
        if (response.success) {
          this.users = response.usuarios.map(usuario => ({
            id: usuario.id_user,
            nombre: usuario.nombre,
            mesa: parseInt(usuario.numero_mesa),
            id_mesa: usuario.id_mesa
          }));
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar usuarios activos:', error);
        this.loading = false;
      }
    });
  }

  // Mapear orden del backend al formato del frontend
  // Calcula dinámicamente el tiempo restante basándose en la fecha de creación
  private mapOrdenToOrder(orden: Orden): Order {
    const estadoMap: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'en_preparacion': 'En preparación',
      'entregada': 'Entregada',
      'pagada': 'Pagada'
    };

    const fechaCreacion = new Date(orden.creada_en);
    const tiempoOriginal = orden.tiempo_estimado;
    
    // Calcular cuántos minutos han transcurrido desde la creación
    const ahora = new Date();
    const minutosTranscurridos = Math.floor((ahora.getTime() - fechaCreacion.getTime()) / 60000);
    
    // Calcular el tiempo restante (original - transcurrido)
    let tiempoRestante = tiempoOriginal - minutosTranscurridos;
    if (tiempoRestante < 0) tiempoRestante = 0;

    return {
      id: orden.id_orden,
      mesa: parseInt(orden.mesa_numero),
      usuario: orden.usuario_nombre,
      estado: estadoMap[orden.status] || orden.status,
      monto: orden.total_monto,
      tiempoEspera: tiempoRestante,
      numeroOrden: orden.numero_orden || '',
      total: orden.total_monto,
      fechaCreacion: fechaCreacion,
      tiempoOriginal: tiempoOriginal
    };
  }

  get filteredOrders() {
    let filtered = [...this.orders];
    const activeFilter = this.estatus.find(e => e.active)?.label;
    if (activeFilter === 'En preparación') {
      filtered = filtered.filter(order => order.estado === 'En preparación');
    } else if (activeFilter === 'Entregada') { 
      filtered = filtered.filter(order => order.estado === 'Entregada');
    } else if (activeFilter === 'Todos') {
      filtered = this.orders;
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      filtered = filtered.filter(order =>
        order.usuario.toLowerCase().includes(term) ||
        order.estado.toLowerCase().includes(term) ||
        order.mesa.toString().includes(term) ||
        order.monto.toString().includes(term) ||
        order.numeroOrden.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    if (this.sortBy) {
        filtered.sort((a: Order, b: Order) => {
            const aValue = a[this.sortBy];
            const bValue = b[this.sortBy];

            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            }
            return this.sortDirection === 'desc' ? comparison * -1 : comparison;
        });
    }

    return filtered;
  }

  openUserSelectionModal() {
    this.isUserSelectionModalVisible = true;
    this.currentStep = 1;
    this.newOrder = { id: 0, numeroOrden: '', total: null, tiempoEspera: null, usuario: '', mesa: 0, estado: 'En proceso', monto: 0 };
    this.totalInvalid = false;
    this.tiempoInvalid = false;
    this.renderer.addClass(document.body, 'modal-open');
    this.loadUsuariosActivos();
  }

  selectEstatus(estatus: any): void {
    this.estatus.forEach(p => p.active = false);
    estatus.active = true;
    this.updateDataForPeriod();
  }

  updateDataForPeriod() {

  }

  selectUserForOrder(user: any) {
    this.newOrder.usuario = user.nombre;
    this.newOrder.mesa = user.mesa;
    this.selectedUser = user; 
    this.currentStep = 2;
  }

  sortOrders(column: keyof Order): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
  }


  openModal(order: Order, action: string) {
   
    this.modalAction = action;
    this.isModalVisible = true;
  }

  closeModal() {
    this.isModalVisible = false;
    this.isUserSelectionModalVisible = false; 
    this.selectedUser = null;
    this.modalAction = '';
    this.newOrder = { id: 0, numeroOrden: '', total: null, tiempoEspera: null, usuario: '', mesa: 0, estado: 'En proceso', monto: 0 };
    this.currentStep = 1;
    this.totalInvalid = false;
    this.tiempoInvalid = false;
    this.renderer.removeClass(document.body, 'modal-open');
  }

  createOrder() {
    this.totalInvalid = false;
    this.tiempoInvalid = false;

    let hasErrors = false;

    if (!this.selectedUser) {
      this.currentStep = 1;
      return;
    }

    if (this.newOrder.total === null || this.newOrder.total === undefined || this.newOrder.total <= 0) {
      this.totalInvalid = true;
      hasErrors = true;
    }

    if (this.newOrder.tiempoEspera === null || this.newOrder.tiempoEspera === undefined || this.newOrder.tiempoEspera < 0) {
      this.tiempoInvalid = true;
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    this.loading = true;
    
    const ordenData = {
      usuario_id: this.selectedUser.id,
      mesa_id: this.selectedUser.id_mesa,
      numero_orden: this.newOrder.numeroOrden || undefined,
      total_monto: this.newOrder.total!,
      tiempo_estimado: this.newOrder.tiempoEspera!,
      establecimientoId: this.establecimientoId
    };

    this.ordenesService.createOrden(ordenData).subscribe({
      next: (response) => {
        if (response.success && response.orden) {
          this.orders.push(this.mapOrdenToOrder(response.orden));
          this.startTimer();
          this.closeModal();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al crear orden:', error);
        this.loading = false;
      }
    });
  }

  onTotalChange(): void {
    this.totalInvalid = false;
  }

  onTiempoChange(): void {
    this.tiempoInvalid = false;
  }

  goBackToUserSelection() {
    this.currentStep = 1;
    this.newOrder.numeroOrden = '';
    this.newOrder.total = null;
    this.newOrder.tiempoEspera = null;
    this.totalInvalid = false;
    this.tiempoInvalid = false;
  }

  toggleOrderStatus(order: Order): void {
    if (order.estado !== 'Entregada') {
      const statusMap: { [key: string]: string } = {
        'Pendiente': 'pendiente',
        'En preparación': 'en_preparacion',
        'Entregada': 'entregada',
        'Pagada': 'pagada'
      };

      this.ordenesService.updateOrdenStatus(
        order.id, 
        'entregada', 
        this.establecimientoId
      ).subscribe({
        next: () => {
          order.estado = 'Entregada';
          order.tiempoEspera = 0;
        },
        error: (error) => {
          console.error('Error al actualizar estado:', error);
          alert('Error al actualizar el estado de la orden.');
        }
      });
    }
  }

  // Al presionar el botón -, guarda el nuevo tiempo deseado y actualiza la fecha base
  decreaseTime(order: Order): void {
    if (order.estado !== 'Entregada' && order.tiempoEspera > 0) {
      // El nuevo tiempo será simplemente el tiempo actual mostrado - 1
      const nuevoTiempo = order.tiempoEspera - 1;
      
      this.ordenesService.updateOrdenTiempo(
        order.id, 
        nuevoTiempo, 
        this.establecimientoId
      ).subscribe({
        next: () => {
          // Actualizar la fecha de creación a "ahora" y el tiempo original al nuevo valor
          order.fechaCreacion = new Date();
          order.tiempoOriginal = nuevoTiempo;
          order.tiempoEspera = nuevoTiempo;
        },
        error: (error) => {
          console.error('Error al actualizar tiempo:', error);
        }
      });
    }
  }

  // Al presionar el botón +, guarda el nuevo tiempo deseado y actualiza la fecha base
  increaseTime(order: Order): void {
    if (order.estado !== 'Entregada') {
      // El nuevo tiempo será simplemente el tiempo actual mostrado + 1
      const nuevoTiempo = order.tiempoEspera + 1;
      
      this.ordenesService.updateOrdenTiempo(
        order.id, 
        nuevoTiempo, 
        this.establecimientoId
      ).subscribe({
        next: () => {
          // Actualizar la fecha de creación a "ahora" y el tiempo original al nuevo valor
          order.fechaCreacion = new Date();
          order.tiempoOriginal = nuevoTiempo;
          order.tiempoEspera = nuevoTiempo;
        },
        error: (error) => {
          console.error('Error al actualizar tiempo:', error);
        }
      });
    }
  }

  toggleDeletionMode(): void {
    this.deletionMode = !this.deletionMode;
    if (!this.deletionMode) {
      this.selectedOrders = [];
    }
  }

  selectOrder(order: Order): void {
    if (this.deletionMode) {
      const index = this.selectedOrders.findIndex(o => o.id === order.id);
      if (index > -1) {
        this.selectedOrders.splice(index, 1); // Deselect
      } else {
        this.selectedOrders.push(order); // Select
      }
    }
  }

  isOrderSelected(order: Order): boolean {
    return this.selectedOrders.some(o => o.id === order.id);
  }

  cancelDeletion(): void {
    this.deletionMode = false;
    this.selectedOrders = [];
  }

  confirmDeletion(): void {
    if (this.selectedOrders.length === 0) {
      return;
    }

    const ids = this.selectedOrders.map(order => order.id);
    this.loading = true;

    this.ordenesService.deleteOrdenes(ids, this.establecimientoId).subscribe({
      next: (response) => {
        if (response.success) {
          // Eliminar las órdenes de la lista local
          this.orders = this.orders.filter(order => !ids.includes(order.id));
          this.deletionMode = false;
          this.selectedOrders = [];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al eliminar órdenes:', error);
        alert('Error al eliminar las órdenes. Por favor, intenta de nuevo.');
        this.loading = false;
      }
    });
  }

  // Prevenir entrada de letras en campos numéricos
  onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    // Permitir: números (0-9), punto decimal (46), Enter (13), Backspace (8), Tab (9)
    if (
      (charCode >= 48 && charCode <= 57) || // 0-9
      charCode === 46 || // punto decimal
      charCode === 13 || // Enter
      charCode === 8 ||  // Backspace
      charCode === 9     // Tab
    ) {
      return true;
    }
    event.preventDefault();
    return false;
  }

  // Iniciar timer para recalcular tiempos automáticamente
  // El cálculo se hace solo en el frontend basándose en la fecha de creación
  // NO se hacen peticiones al backend, el tiempo se actualiza dinámicamente
  private startTimer(): void {
    // Limpiar timer anterior si existe
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Recalcular cada minuto (60000 ms)
    this.timerInterval = setInterval(() => {
      this.updateOrderTimes();
    }, 60000);
  }

  // Recalcular tiempos de espera basándose en la fecha de creación
  private updateOrderTimes(): void {
    const ahora = new Date();
    
    this.orders.forEach(order => {
      if (order.estado !== 'Entregada' && order.estado !== 'Pagada') {
        // Calcular minutos transcurridos desde la creación
        const minutosTranscurridos = Math.floor((ahora.getTime() - order.fechaCreacion.getTime()) / 60000);
        
        // Calcular tiempo restante
        let tiempoRestante = order.tiempoOriginal - minutosTranscurridos;
        if (tiempoRestante < 0) tiempoRestante = 0;
        
        // Actualizar solo localmente
        order.tiempoEspera = tiempoRestante;
      }
    });
  }
}