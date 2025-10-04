import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';

export const routes: Routes = [
  { path: '', component: LoginComponent, pathMatch: 'full' },
  { path: 'layout', component: LayoutComponent },
  { path: '**', component: LoginComponent },
];
