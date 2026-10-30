import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Listado } from './pages/listado/listado';
import { Detalle } from './pages/detalle/detalle';
import { Login } from './pages/login/login';
import { Admin } from './pages/admin/admin';
import { AdminForm } from './pages/admin-form/admin-form';
import { AdminEtiquetas } from './pages/admin-etiquetas/admin-etiquetas';
import { authGuard } from './guards/auth-guard';


export const routes: Routes = [
  { path: '', component: Home },
  { path: 'listado/:tipo', component: Listado },
  { path: 'entrada/:id', component: Detalle },
  { path: 'login', component: Login },
  { path: 'admin', component: Admin, canActivate: [authGuard] },
  { path: 'admin/nueva', component: AdminForm, canActivate: [authGuard] },
  { path: 'admin/editar/:id', component: AdminForm, canActivate: [authGuard] },
  { path: 'admin/etiquetas', component: AdminEtiquetas, canActivate: [authGuard] },
  { path: 'etiqueta/:nombre', component: Listado },
];