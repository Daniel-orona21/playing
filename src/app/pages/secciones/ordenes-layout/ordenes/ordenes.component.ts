import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  newOrder: any = { numeroOrden: '', total: null, tiempoEspera: null, usuario: null, mesa: null, estado: 'En proceso' };
  currentStep: number = 1;
  estatus = [
    { label: 'En preparación', active: false, value: 'En preparación' },
    { label: 'Entregada', active: false, value: 'Entregada' },
    { label: 'Todas', active: true, value: 'todos' },
  ];

  deletionMode: boolean = false;
  selectedOrders: any[] = [];

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

  orders = [
    { id: 31, mesa: 6, usuario: 'Zabdiel Morales', estado: 'En preparación', monto: 295, tiempoEspera: 14, numeroOrden: '31' },
    { id: 32, mesa: 1, usuario: 'Mylthon Sánchez', estado: 'En preparación', monto: 310, tiempoEspera: 13, numeroOrden: '32' },
    { id: 33, mesa: 3, usuario: 'Alan Gurrola', estado: 'Entregada', monto: 420, tiempoEspera: 0, numeroOrden: '33' },
    { id: 34, mesa: 2, usuario: 'Alejandro Monreal', estado: 'En preparación', monto: 300, tiempoEspera: 21, numeroOrden: '34' },
    { id: 35, mesa: 4, usuario: 'Daniel Orona', estado: 'Entregada', monto: 180, tiempoEspera: 0, numeroOrden: '35' },
    { id: 36, mesa: 5, usuario: 'Marco Valdéz', estado: 'Entregada', monto: 350, tiempoEspera: 0, numeroOrden: '36' },
    { id: 37, mesa: 7, usuario: 'Kevin', estado: 'En preparación', monto: 400, tiempoEspera: 6, numeroOrden: '37' },
    { id: 38, mesa: 9, usuario: 'Rafita', estado: 'En preparación', monto: 9999, tiempoEspera: 15, numeroOrden: '38' },
    { id: 39, mesa: 8, usuario: 'Blanca Romero', estado: 'Entregada', monto: 170, tiempoEspera: 0, numeroOrden: '39' },
    { id: 40, mesa: 10, usuario: 'Bravito', estado: 'En preparación', monto: 20, tiempoEspera: 7, numeroOrden: '40' },
  ];

  searchTerm: string = '';

  get filteredOrders() {
    let filtered = this.orders;
    const activeFilter = this.estatus.find(e => e.active)?.label;
    if (activeFilter === 'En preparación') {
      filtered = filtered.filter(order => order.estado === 'En preparación');
    } else if (activeFilter === 'Entregada') { 
      filtered = filtered.filter(order => order.estado === 'Entregada');
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      filtered = filtered.filter(order =>
        order.usuario.toLowerCase().includes(term) ||
        order.estado.toLowerCase().includes(term) ||
        order.mesa.toString().includes(term) ||
        order.monto.toString().includes(term)
      );
    }
    return filtered;
  }

  openUserSelectionModal() {
    this.isUserSelectionModalVisible = true;
    this.currentStep = 1;
    this.newOrder = { numeroOrden: '', total: null, tiempoEspera: null, usuario: null, mesa: null, estado: 'En proceso' };
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


  openModal(order: any, action: string) {
   
    this.modalAction = action;
    this.isModalVisible = true;
  }

  closeModal() {
    this.isModalVisible = false;
    this.isUserSelectionModalVisible = false; 
    this.selectedUser = null;
    this.modalAction = '';
    this.newOrder = { numeroOrden: '', total: null, tiempoEspera: null, usuario: null, mesa: null, estado: 'En proceso' };
    this.currentStep = 1;
  }

  createOrder() {
    if (this.newOrder.usuario && this.newOrder.numeroOrden && this.newOrder.total !== null && this.newOrder.tiempoEspera !== null) {
      const newId = this.orders.length > 0 ? Math.max(...this.orders.map(o => o.id)) + 1 : 1;
      this.orders.push({
        id: newId,
        mesa: this.newOrder.mesa,
        usuario: this.newOrder.usuario,
        estado: this.newOrder.estado,
        monto: this.newOrder.total,
        tiempoEspera: this.newOrder.tiempoEspera,
        numeroOrden: this.newOrder.numeroOrden // Add numeroOrden here
      });
      this.closeModal();
    } else {
      alert('Por favor, completa todos los campos de la orden.');
    }
  }

  goBackToUserSelection() {
    this.currentStep = 1;
    this.newOrder.numeroOrden = '';
    this.newOrder.total = null;
    this.newOrder.tiempoEspera = null;
  }

  toggleOrderStatus(order: any): void {
    if (order.estado !== 'Entregada') {
      order.estado = 'Entregada';
      order.tiempoEspera = 0;
    }
  }

  decreaseTime(order: any): void {
    if (order.estado !== 'Entregada' && order.tiempoEspera > 0) {
      order.tiempoEspera--;
    }
  }

  increaseTime(order: any): void {
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

  selectOrder(order: any): void {
    if (this.deletionMode) {
      const index = this.selectedOrders.findIndex(o => o.id === order.id);
      if (index > -1) {
        this.selectedOrders.splice(index, 1); // Deselect
      } else {
        this.selectedOrders.push(order); // Select
      }
    }
  }

  isOrderSelected(order: any): boolean {
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