import { Component, OnInit, signal, computed } from '@angular/core';import { RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { ApiService, Entrada } from '../../services/api';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  entradas = signal<Entrada[]>([]);
  cargando = signal(true);
  borrandoId = signal<string | null>(null);

  ordenarPor = signal<'Tipo' | 'Anio' | null>(null);
  direccion = signal<'asc' | 'desc'>('asc');

  entradasOrdenadas = computed(() =>
  {
    const campo = this.ordenarPor();
    const lista = [...this.entradas()];

    if (!campo) return lista;

    return lista.sort((a, b) => {
      const comparacion = campo === 'Anio'
        ? a.Anio - b.Anio
        : a.Tipo.localeCompare(b.Tipo);
      return this.direccion() === 'asc' ? comparacion : -comparacion;
    });
  });

  constructor(private api: ApiService, public auth: Auth) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.listarEntradas().subscribe({
      next: (datos) => { this.entradas.set(datos); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  borrar(id: string, nombre: string) {
    if (!confirm(`¿Seguro que quieres eliminar "${nombre}"?`)) return;
    this.borrandoId.set(id);
    this.api.borrarEntrada(id).subscribe({
      next: () => {
        this.entradas.update((actuales) => actuales.filter((e) => e.Id !== id));
        this.borrandoId.set(null);
      },
      error: () => { alert('No se pudo eliminar la entrada'); this.borrandoId.set(null); }
    });
  }

  logout() {
    this.auth.logout();
  }

  ordenar(campo: 'Tipo' | 'Anio') {
    if (this.ordenarPor() === campo) {
      this.direccion.set(this.direccion() === 'asc' ? 'desc' : 'asc');
    } else {
      this.ordenarPor.set(campo);
      this.direccion.set('asc');
    }
  }
}