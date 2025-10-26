import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { MusicaComponent } from './pages/secciones/musica/musica.component';
import { OrdenesComponent } from './pages/secciones/ordenes-layout/ordenes/ordenes.component';
import { JuegoComponent } from './pages/secciones/juego/juego.component';
import { AjustesComponent } from './pages/secciones/ajustes/ajustes.component';
import { ListaComponent } from './pages/secciones/musica/vistas/lista/lista.component';
import { BusquedaComponent } from './pages/secciones/musica/vistas/busqueda/busqueda.component';
import { FiltroComponent } from './pages/secciones/musica/vistas/filtro/filtro.component';
import { OrdenesLayoutComponent } from './pages/secciones/ordenes-layout/ordenes-layout.component';
import { UsuariosComponent } from './pages/secciones/ordenes-layout/usuarios/usuarios.component';
import { CallbackSpotifyComponent } from './pages/callback-spotify/callback-spotify.component';
import { AuthGuard } from './guards/auth.guard';
import { PublicaComponent } from './pages/secciones/publica/publica.component';

export const routes: Routes = [
  { path: '', component: LoginComponent, pathMatch: 'full' },
  { 
    path: 'layout', 
    component: LayoutComponent,
    canActivate: [AuthGuard],
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
      { 
        path: 'ordenes', 
        component: OrdenesLayoutComponent,
        data: { animation: 'OrdenesPage' },
        children: [
          { path: '', redirectTo: 'ordenes', pathMatch: 'full' },
          { path: 'ordenes', component: OrdenesComponent, data: { animation: 'OrdenesChildPage' } },
          { path: 'usuarios', component: UsuariosComponent, data: { animation: 'UsuariosChildPage' } }
        ]
      },
      { path: 'games', component: JuegoComponent, data: { animation: 'GamesPage' } },
      { path: 'settings', component: AjustesComponent, data: { animation: 'SettingsPage' } }
    ]
  },
  { path: 'callback/spotify', component: CallbackSpotifyComponent },
  { path: 'vista/:establecimientoId', component: PublicaComponent },
  { path: '**', component: LoginComponent },
];
