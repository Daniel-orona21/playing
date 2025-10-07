import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Order {
  id: number;
  mesa: number;
  usuario: string;
  estado: string;
  monto: number;
  tiempoEspera: number;
  numeroOrden: string;
  total: number;
}

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss'
})
export class OrdenesComponent {
  isModalVisible = false;
  selectedUser: any = null;
  modalAction = '';
  isUserSelectionModalVisible: boolean = false;
  newOrder: Order = { id: 0, numeroOrden: '', total: 0, tiempoEspera: 0, usuario: '', mesa: 0, estado: 'En proceso', monto: 0 };
  currentStep: number = 1;
  estatus = [
    { label: 'En preparación', active: false, value: 'En preparación' },
    { label: 'Entregada', active: false, value: 'Entregada' },
    { label: 'Todas', active: true, value: 'todos' },
  ];

  deletionMode: boolean = false;
  selectedOrders: Order[] = [];

  users = [
    { id: 1, nombre: 'Mylthon Sánchez', mesa: 1 },
    { id: 2, nombre: 'Alejandro Monreal', mesa: 2 },
    { id: 3, nombre: 'Alan Gurrola', mesa: 3 },
    { id: 4, nombre: 'Daniel Orona', mesa: 4 },
    { id: 5, nombre: 'Marco Valdéz', mesa: 5 },
    { id: 6, nombre: 'Zabdiel Morales', mesa: 6 },
    { id: 7, nombre: 'Kevin', mesa: 7 },
    { id: 8, nombre: 'Blanca Romero', mesa: 8 },
    { id: 9, nombre: 'Rafita', mesa: 9 },
    { id: 10, nombre: 'Bravito', mesa: 10 },
  ];

  orders: Order[] = [
    { id: 31, mesa: 6, usuario: 'Zabdiel Morales', estado: 'En preparación', monto: 295, tiempoEspera: 14, numeroOrden: '31', total: 295 },
    { id: 32, mesa: 1, usuario: 'Mylthon Sánchez', estado: 'En preparación', monto: 310, tiempoEspera: 13, numeroOrden: '32', total: 310 },
    { id: 33, mesa: 3, usuario: 'Alan Gurrola', estado: 'Entregada', monto: 420, tiempoEspera: 0, numeroOrden: '33', total: 420 },
    { id: 34, mesa: 2, usuario: 'Alejandro Monreal', estado: 'En preparación', monto: 300, tiempoEspera: 21, numeroOrden: '34', total: 300 },
    { id: 35, mesa: 4, usuario: 'Daniel Orona', estado: 'Entregada', monto: 180, tiempoEspera: 0, numeroOrden: '35', total: 180 },
    { id: 36, mesa: 5, usuario: 'Marco Valdéz', estado: 'Entregada', monto: 350, tiempoEspera: 0, numeroOrden: '36', total: 350 },
    { id: 37, mesa: 7, usuario: 'Kevin', estado: 'En preparación', monto: 400, tiempoEspera: 6, numeroOrden: '37', total: 400 },
    { id: 38, mesa: 9, usuario: 'Rafita', estado: 'En preparación', monto: 9999, tiempoEspera: 15, numeroOrden: '38', total: 9999 },
    { id: 39, mesa: 8, usuario: 'Blanca Romero', estado: 'Entregada', monto: 170, tiempoEspera: 0, numeroOrden: '39', total: 170 },
    { id: 40, mesa: 10, usuario: 'Bravito', estado: 'En preparación', monto: 20, tiempoEspera: 7, numeroOrden: '40', total: 20 },
  ];

  searchTerm: string = '';
  sortBy: keyof Order = 'numeroOrden'; // Default sort by numeroOrden
  sortDirection: 'asc' | 'desc' = 'asc'; // Default sort direction

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
    this.newOrder = { id: 0, numeroOrden: '', total: 0, tiempoEspera: 0, usuario: '', mesa: 0, estado: 'En proceso', monto: 0 };
  }

  selectEstatus(estatus: any): void {
    this.estatus.forEach(p => p.active = false);
    estatus.active = true;
    this.updateDataForPeriod();
  }

  updateDataForPeriod() {
    // The filtering is now reactive through filteredOrders
  }

  selectUserForOrder(user: any) {
    this.newOrder.usuario = user.nombre;
    this.newOrder.mesa = user.mesa;
    this.selectedUser = user; // Assign the selected user to selectedUser
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
    this.newOrder = { id: 0, numeroOrden: '', total: 0, tiempoEspera: 0, usuario: '', mesa: 0, estado: 'En proceso', monto: 0 };
    this.currentStep = 1;
  }

  createOrder() {
    if (this.newOrder.usuario && this.newOrder.numeroOrden) {
      const newId = this.orders.length > 0 ? Math.max(...this.orders.map(o => o.id)) + 1 : 1;
      this.orders.push({
        id: newId,
        mesa: this.newOrder.mesa,
        usuario: this.newOrder.usuario,
        estado: this.newOrder.estado,
        monto: this.newOrder.total,
        tiempoEspera: this.newOrder.tiempoEspera,
        numeroOrden: this.newOrder.numeroOrden, // Add numeroOrden here
        total: this.newOrder.total
      });
      this.closeModal();
    } else {
      alert('Por favor, completa todos los campos de la orden.');
    }
  }

  goBackToUserSelection() {
    this.currentStep = 1;
    this.newOrder.numeroOrden = '';
    this.newOrder.total = 0;
    this.newOrder.tiempoEspera = 0;
  }

  toggleOrderStatus(order: Order): void {
    if (order.estado !== 'Entregada') {
      order.estado = 'Entregada';
      order.tiempoEspera = 0;
    }
  }

  decreaseTime(order: Order): void {
    if (order.estado !== 'Entregada' && order.tiempoEspera > 0) {
      order.tiempoEspera--;
    }
  }

  increaseTime(order: Order): void {
    if (order.estado !== 'Entregada') {
      order.tiempoEspera++;
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
    this.orders = this.orders.filter(order => !this.selectedOrders.some(selected => selected.id === order.id));
    this.deletionMode = false;
    this.selectedOrders = [];
  }
}