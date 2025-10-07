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
  estatus = [
    { label: 'Todos', active: true, value: 'todos' },
    { label: 'Pendiente', active: false, value: 'Pendiente' },
    { label: 'En proceso', active: false, value: 'En proceso' },
    { label: 'Entregada', active: false, value: 'Entregada' },
    { label: 'Cancelada', active: false, value: 'Cancelada' },
  ];

  deletionMode: boolean = false;
  selectedOrders: any[] = [];

  orders = [
    { id: 31, mesa: 6, usuario: 'Zabdiel Morales', estado: 'En preparación', monto: 295, tiempoEspera: 14 },
    { id: 32, mesa: 1, usuario: 'Mylthon Sánchez', estado: 'En preparación', monto: 310, tiempoEspera: 13 },
    { id: 33, mesa: 3, usuario: 'Alan Gurrola', estado: 'Entregada', monto: 420, tiempoEspera: 0 },
    { id: 34, mesa: 2, usuario: 'Alejandro Monreal', estado: 'En preparación', monto: 300, tiempoEspera: 21 },
    { id: 35, mesa: 4, usuario: 'Daniel Orona', estado: 'Entregada', monto: 180, tiempoEspera: 0 },
    { id: 36, mesa: 5, usuario: 'Marco Valdéz', estado: 'Entregada', monto: 350, tiempoEspera: 0 },
    { id: 37, mesa: 7, usuario: 'Kevin', estado: 'En preparación', monto: 400, tiempoEspera: 6 },
    { id: 38, mesa: 9, usuario: 'Rafita', estado: 'En preparación', monto: 9999, tiempoEspera: 15 },
    { id: 39, mesa: 8, usuario: 'Blanca Romero', estado: 'Entregada', monto: 170, tiempoEspera: 0 },
    { id: 40, mesa: 10, usuario: 'Bravito', estado: 'En preparación', monto: 20, tiempoEspera: 7 },
  ];

  searchTerm: string = '';

  get filteredOrders() {
    let filtered = this.orders;
    const activeFilter = this.estatus.find(e => e.active)?.label;
    if (activeFilter === 'En preparación') {
      filtered = filtered.filter(order => order.estado === 'En preparación');
    } else if (activeFilter === 'Entregadas') {
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

  openNewUserModal() {
    // This modal is for users, not orders. We might need to adjust or remove it if not needed for orders.
    // For now, I'll keep it as is, but it will operate on a dummy object.
    this.selectedUser = { id: 0, nombre: '', correo: '', area: '', rol: '', sucursal: '', estatus: 'Activo' };
    this.modalAction = 'new';
    this.isModalVisible = true;
  }

  selectEstatus(estatus: any): void {
    this.estatus.forEach(p => p.active = false);
    estatus.active = true;
    this.updateDataForPeriod();
  }

  updateDataForPeriod() {
    // The filtering is now reactive through filteredOrders
  }


  openModal(order: any, action: string) {
    // Assuming a similar modal for orders if needed, for now, just assigning selectedUser.
    this.selectedUser = { ...order }; // Using selectedUser for consistency, will revisit if a dedicated order modal is needed.
    this.modalAction = action;
    this.isModalVisible = true;
  }

  closeModal() {
    this.isModalVisible = false;
    this.selectedUser = null;
    this.modalAction = '';
  }

  saveUser() {
    // This function is for users, not orders. Needs to be adapted or removed.
    // For now, it will not perform any action related to orders.
    this.closeModal();
  }

  deleteUser() {
    // This function is for users, not orders. Needs to be adapted or removed.
    // For now, it will not perform any action related to orders.
    this.closeModal();
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