import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface User {
  id: number;
  nombre: string;
  mesa: number;
  estado: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss'
})
export class UsuariosComponent {
  isModalVisible = false;
  selectedUser: User | null = null;
  modalAction = '';
  isUserSelectionModalVisible: boolean = false;
  currentStep: number = 1;
  estatus = [
    { label: 'En preparación', active: false, value: 'En preparación' },
    { label: 'Entregada', active: false, value: 'Entregada' },
    { label: 'Inactiva', active: false, value: 'Inactiva' },
    { label: 'Todos', active: true, value: 'todos' },
  ];

  deletionMode: boolean = false;
  selectedUsers: User[] = [];

  users: User[] = [
    { id: 1, nombre: 'Mylthon Sánchez', mesa: 1, estado: 'En preparación' },
    { id: 2, nombre: 'Alejandro Monreal', mesa: 2, estado: 'Entregada' },
    { id: 3, nombre: 'Alan Gurrola', mesa: 3, estado: 'Entregada' },
    { id: 4, nombre: 'Daniel Orona', mesa: 4, estado: 'Entregada' },
    { id: 5, nombre: 'Marco Valdéz', mesa: 5, estado: 'Entregada' },
    { id: 6, nombre: 'Zabdiel Morales', mesa: 6, estado: 'Entregada' },
    { id: 7, nombre: 'Kevin', mesa: 7, estado: 'Entregada' },
    { id: 8, nombre: 'Blanca Romero', mesa: 8, estado: 'Inactiva' },
    { id: 9, nombre: 'Rafita', mesa: 9, estado: 'Inactiva' },
    { id: 10, nombre: 'Bravito', mesa: 10, estado: 'Inactiva' },
  ];

  
  searchTerm: string = '';
  sortBy: keyof User = 'nombre'; // Default sort by nombre
  sortDirection: 'asc' | 'desc' = 'asc'; // Default sort direction

  get filteredUsers() {
    let filtered = [...this.users]; // Create a shallow copy to avoid modifying the original array during filtering/sorting
    const activeFilter = this.estatus.find(e => e.active)?.label;
    if (activeFilter === 'En preparación') {
      filtered = filtered.filter(user => user.estado === 'En preparación');
    } else if (activeFilter === 'Entregada') {
      filtered = filtered.filter(user => user.estado === 'Entregada');
    } else if (activeFilter === 'Inactiva') { 
      filtered = filtered.filter(user => user.estado === 'Inactiva');
    } else if (activeFilter === 'Todos') {
        filtered = this.users;
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      filtered = filtered.filter(user =>
        user.nombre.toLowerCase().includes(term) ||
        user.estado.toLowerCase().includes(term) ||
        user.mesa.toString().includes(term)
      );
    }

    // Apply sorting
    if (this.sortBy) {
        filtered.sort((a: User, b: User) => {
            const aValue = a[this.sortBy];
            const bValue = b[this.sortBy];

            let comparison = 0;
            if (aValue > bValue) {
                comparison = 1;
            } else if (aValue < bValue) {
                comparison = -1;
            }
            return this.sortDirection === 'desc' ? comparison * -1 : comparison;
        });
    }

    return filtered;
  }

  // Removed order-related methods
  

  selectEstatus(estatus: any): void {
    this.estatus.forEach(p => p.active = false);
    estatus.active = true;
    this.updateDataForPeriod();
  }

  updateDataForPeriod() {
    // The filtering is now reactive through filteredUsers
  }

  sortUsers(column: keyof User): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
  }

  openModal(user: User, action: string) {
   
    this.modalAction = action;
    this.isModalVisible = true;
    this.selectedUser = { ...user };
  }

  closeModal() {
    this.isModalVisible = false;
    this.selectedUser = null;
    this.modalAction = '';
  }

  saveUser() {
    if (this.selectedUser && this.selectedUser.nombre && this.selectedUser.estado && this.selectedUser.mesa) {
      const index = this.users.findIndex(u => u.id === this.selectedUser!.id);
      if (index > -1) {
        this.users[index] = { ...this.selectedUser };
      }
      this.closeModal();
    } else {
      alert('Por favor, completa todos los campos del usuario.');
    }
  }

  toggleDeletionMode(): void {
    this.deletionMode = !this.deletionMode;
    if (!this.deletionMode) {
      this.selectedUsers = [];
    }
  }

  selectUser(user: User): void {
    if (this.deletionMode) {
      const index = this.selectedUsers.findIndex(o => o.id === user.id);
      if (index > -1) {
        this.selectedUsers.splice(index, 1); // Deselect
      } else {
        this.selectedUsers.push(user); // Select
      }
    }
  }

  isUserSelected(user: User): boolean {
    return this.selectedUsers.some(o => o.id === user.id);
  }

  cancelDeletion(): void {
    this.deletionMode = false;
    this.selectedUsers = [];
  }

  confirmDeletion(): void {
    this.users = this.users.filter(user => !this.selectedUsers.some(selected => selected.id === user.id));
    this.deletionMode = false;
    this.selectedUsers = [];
  }
}