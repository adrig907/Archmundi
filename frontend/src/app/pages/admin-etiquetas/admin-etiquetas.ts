import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { ApiService, Etiqueta } from '../../services/api';

@Component({
  selector: 'app-admin-etiquetas',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './admin-etiquetas.html',
  styleUrl: './admin-etiquetas.css'
})
export class AdminEtiquetas implements OnInit {
  arbol = signal<Etiqueta[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  nombreCategoria = '';
  nombreSubcategoria: Record<string, string> = {}; // una entrada por categoría, para su input de subcategoría

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.listarEtiquetas().subscribe({
      next: (datos) => { this.arbol.set(datos); this.cargando.set(false); },
      error: () => { this.error.set('No se pudieron cargar las etiquetas'); this.cargando.set(false); }
    });
  }

  crearCategoria() {
    if (!this.nombreCategoria.trim()) return;
    this.api.crearEtiqueta(this.nombreCategoria.trim()).subscribe({
      next: () => { this.nombreCategoria = ''; this.cargar(); },
      error: (err) => this.error.set(err.error?.error || 'Error al crear la categoría')
    });
  }

  crearSubcategoria(categoriaId: string) {
    const nombre = this.nombreSubcategoria[categoriaId];
    if (!nombre?.trim()) return;
    this.api.crearEtiqueta(nombre.trim(), categoriaId).subscribe({
      next: () => { this.nombreSubcategoria[categoriaId] = ''; this.cargar(); },
      error: (err) => this.error.set(err.error?.error || 'Error al crear la subcategoría')
    });
  }

  borrar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"? Si es una categoría, también se borrarán sus subcategorías.`)) return;
    this.api.borrarEtiqueta(id).subscribe({
      next: () => this.cargar(),
      error: () => this.error.set('No se pudo eliminar')
    });
  }
}