import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

interface RespuestaLogin {
  token: string;
  admin: { id: string; email: string; nombre: string };
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private baseUrl = '/api/auth';
  private esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  admin = signal<RespuestaLogin['admin'] | null>(this.leerAdminGuardado());

  constructor(private http: HttpClient) {}

  private leerAdminGuardado() {
    if (!this.esNavegador) return null;
    const guardado = localStorage.getItem('admin');
    return guardado ? JSON.parse(guardado) : null;
  }

  login(email: string, password: string): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(`${this.baseUrl}/login`, { email, password }).pipe(
      tap((respuesta) => {
        if (!this.esNavegador) return;
        localStorage.setItem('token', respuesta.token);
        localStorage.setItem('admin', JSON.stringify(respuesta.admin));
        this.admin.set(respuesta.admin);
      })
    );
  }

  logout() {
    if (this.esNavegador) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
    }
    this.admin.set(null);
  }

  estaAutenticado(): boolean {
    return this.esNavegador && !!localStorage.getItem('token');
  }

  obtenerToken(): string | null {
    return this.esNavegador ? localStorage.getItem('token') : null;
  }
}