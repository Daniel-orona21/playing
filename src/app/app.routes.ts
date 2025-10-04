import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { MusicaComponent } from './pages/secciones/musica/musica.component';
import { OrdenesComponent } from './pages/secciones/ordenes/ordenes.component';
import { JuegoComponent } from './pages/secciones/juego/juego.component';
import { AjustesComponent } from './pages/secciones/ajustes/ajustes.component';
import { ListaComponent } from './pages/secciones/musica/vistas/lista/lista.component';
import { BusquedaComponent } from './pages/secciones/musica/vistas/busqueda/busqueda.component';
import { FiltroComponent } from './pages/secciones/musica/vistas/filtro/filtro.component';

export const routes: Routes = [
  { path: '', component: LoginComponent, pathMatch: 'full' },
  { 
    path: 'layout', 
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'music', pathMatch: 'full' },
      { 
        path: 'music', 
        component: MusicaComponent,
        data: { animation: 'MusicPage' },
        children: [
          { path: '', redirectTo: 'lista', pathMatch: 'full' },
          { path: 'lista', component: ListaComponent, data: { animation: 'ListaPage' } },
          { path: 'busqueda', component: BusquedaComponent, data: { animation: 'BusquedaPage' } },
          { path: 'filtro', component: FiltroComponent, data: { animation: 'FiltroPage' } }
        ]
      },
      { path: 'playlist', component: OrdenesComponent, data: { animation: 'PlaylistPage' } },
      { path: 'games', component: JuegoComponent, data: { animation: 'GamesPage' } },
      { path: 'settings', component: AjustesComponent, data: { animation: 'SettingsPage' } }
    ]
  },
  { path: '**', component: LoginComponent },
];
