import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { OrdenesService } from '../../../../services/ordenes.service';
import { LlamadasService, Llamada } from '../../../../services/llamadas.service';
import { ToastService } from '../../../../services/toast.service';

interface User {
  id: number;
  nombre: string;
  mesa: number;
  estado: string;
  llamando?: boolean;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss'
})
export class UsuariosComponent implements OnInit, OnDestroy {
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

  users: User[] = [];
  private establecimientoId: number | null = null;
  llamadasPendientes: Llamada[] = [];

  
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
            const aValue = a[this.sortBy] ?? '';
            const bValue = b[this.sortBy] ?? '';

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

  private socket: any;

  constructor(
    private http: HttpClient, 
    private auth: AuthService,
    private ordenesService: OrdenesService,
    private llamadasService: LlamadasService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadClientes();
    // Socket: unirse al room del establecimiento
    this.http.get<{ success: boolean; establecimiento: any }>(`${environment.apiUrl}/establecimientos/mio`, { headers: this.buildHeaders() })
      .subscribe(({ establecimiento }) => {
        if (!establecimiento) return;
        this.establecimientoId = establecimiento.id_establecimiento;
        
        // Cargar llamadas pendientes iniciales
        this.loadLlamadasPendientes();
        
        import('socket.io-client').then(({ io }) => {
          const baseUrl = (environment.apiUrl as any).replace('/api','');
          console.log('🔌 Usuarios: Conectando socket a:', baseUrl);
          this.socket = io(baseUrl, { 
            transports: ['websocket', 'polling'],
            reconnection: true 
          });
          
          // Esperar a que el socket se conecte ANTES de unirse a la sala
          this.socket.on('connect', () => {
            console.log('✅ Usuarios: Socket conectado');
            this.socket.emit('join_establecimiento', this.establecimientoId!);
            console.log('📍 Usuarios: Unido a sala establecimiento:', this.establecimientoId);
          });
          
          this.socket.on('connect_error', (error: any) => {
            console.error('❌ Usuarios: Error de conexión socket:', error);
          });
          
          this.socket.on('establecimiento:clientes_actualizados', () => this.loadClientes());
          
          // Escuchar eventos de llamadas
          this.socket.on('llamada_created', (llamada: Llamada) => {
            console.log('✅ Usuarios: llamada_created recibida', llamada);
            this.llamadasPendientes.push(llamada);
            this.actualizarEstadoLlamadas();
          });
          
          this.socket.on('llamada_atendida', (data: { id_llamada: number }) => {
            console.log('✅ Usuarios: llamada_atendida recibida', data);
            this.llamadasPendientes = this.llamadasPendientes.filter(l => l.id_llamada !== data.id_llamada);
            this.actualizarEstadoLlamadas();
            // También cerrar el toast correspondiente
            this.toastService.closeByLlamadaId(data.id_llamada);
          });
          
          this.socket.on('llamada_cancelada', (data: { id_llamada: number }) => {
            console.log('✅ Usuarios: llamada_cancelada recibida', data);
            this.llamadasPendientes = this.llamadasPendientes.filter(l => l.id_llamada !== data.id_llamada);
            this.actualizarEstadoLlamadas();
            // También cerrar el toast correspondiente
            this.toastService.closeByLlamadaId(data.id_llamada);
          });
        });
      });
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private buildHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  loadClientes(): void {
    // Obtener establecimiento del admin
    this.http.get<{ success: boolean; establecimiento: any }>(`${environment.apiUrl}/establecimientos/mio`, { headers: this.buildHeaders() })
      .subscribe(({ establecimiento }) => {
        if (!establecimiento) {
          this.users = [];
          return;
        }
        this.establecimientoId = establecimiento.id_establecimiento;
        
        // Obtener el estado de las órdenes de los usuarios
        this.ordenesService.getEstadoOrdenesUsuarios(establecimiento.id_establecimiento)
          .subscribe({
            next: (response) => {
              if (response.success) {
                this.users = response.usuarios.map(u => ({
                  id: u.id,
                  nombre: u.nombre,
                  mesa: u.mesa,
                  estado: u.estado,
                  llamando: false
                }));
                this.actualizarEstadoLlamadas();
              }
            },
            error: (error) => {
              console.error('Error al cargar usuarios con estado:', error);
              this.users = [];
            }
          });
      });
  }

  loadLlamadasPendientes(): void {
    if (!this.establecimientoId) return;
    
    this.llamadasService.getLlamadasPendientes(this.establecimientoId).subscribe({
      next: (response) => {
        if (response.success) {
          this.llamadasPendientes = response.llamadas;
          this.actualizarEstadoLlamadas();
        }
      },
      error: (error) => {
        console.error('Error al cargar llamadas pendientes:', error);
      }
    });
  }

  actualizarEstadoLlamadas(): void {
    // Marcar usuarios que están llamando
    this.users.forEach(user => {
      user.llamando = this.llamadasPendientes.some(l => l.usuario_id === user.id);
    });
  }

  atenderLlamada(idLlamada: number): void {
    this.llamadasService.marcarLlamadaAtendida(idLlamada).subscribe({
      next: (response) => {
        if (response.success) {
          // Remover de la lista local
          this.llamadasPendientes = this.llamadasPendientes.filter(l => l.id_llamada !== idLlamada);
          this.actualizarEstadoLlamadas();
        }
      },
      error: (error) => {
        console.error('Error al atender llamada:', error);
        alert('Error al atender la llamada. Por favor, intenta de nuevo.');
      }
    });
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
    } else {
      // Mostrar toast de instrucciones cuando se activa el modo de eliminación
      this.toastService.info('Selecciona uno o más usuarios y confirma para eliminarlos', 5000);
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
    if (!this.establecimientoId || this.selectedUsers.length === 0) {
      this.deletionMode = false;
      this.selectedUsers = [];
      return;
    }
    const ids = this.selectedUsers.map(u => u.id);
    this.http.post<{ success: boolean; affected: number }>(`${environment.apiUrl}/establecimientos/${this.establecimientoId}/kick`, { user_ids: ids }, { headers: this.buildHeaders() })
      .subscribe({
        next: () => {
          this.deletionMode = false;
          this.selectedUsers = [];
          // la lista se refresca por socket; como fallback, recargar
          this.loadClientes();
        },
        error: () => {
          this.deletionMode = false;
          this.selectedUsers = [];
          this.loadClientes();
        }
      });
  }
}