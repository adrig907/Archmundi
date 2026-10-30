import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { ApiService, Etiqueta } from '../../services/api';

@Component({
  selector: 'app-admin-form',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor],
  templateUrl: './admin-form.html',
  styleUrl: './admin-form.css'
})
export class AdminForm implements OnInit {
  @ViewChild('dialogoError') dialogoError!: ElementRef<HTMLDialogElement>;

  esEdicion = false;
  id = '';

  nombre = '';
  anio = '';
  tipo = 'foto';
  archivo: File | null = null;

  arbol = signal<Etiqueta[]>([]);
  etiquetasSeleccionadas = signal<string[]>([]);

  enviando = signal(false);
  error = signal<string | null>(null);
  cargando = signal(false);

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  ngOnInit() {
    this.api.listarEtiquetas().subscribe((arbol) => this.arbol.set(arbol));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.esEdicion = true;
      this.id = idParam;
      this.cargando.set(true);
      this.api.obtenerEntrada(this.id).subscribe((entrada) => {
        this.nombre = entrada.Nombre;
        this.anio = String(entrada.Anio);
        this.tipo = entrada.Tipo;
        this.etiquetasSeleccionadas.set(entrada.etiquetas || []);
        this.cargando.set(false);
      });
    }
  }

  actualizarSeleccion(event: Event) {
    const select = event.target as HTMLSelectElement;
    const elegidas = Array.from(select.selectedOptions).map((o) => o.value);

    const conPadres = new Set(elegidas);
    for (const cat of this.arbol()) {
      for (const sub of cat.subcategorias || []) {
        if (conPadres.has(sub.Nombre)) conPadres.add(cat.Nombre);
      }
    }

    // Forzamos el estado real de cada <option> en el DOM, por si el usuario
    // acaba de intentar deseleccionar una categoría que sigue siendo necesaria
    // porque una de sus subcategorías continúa marcada.
    for (const option of Array.from(select.options)) {
      option.selected = conPadres.has(option.value);
    }

    this.etiquetasSeleccionadas.set([...conPadres]);
  }

  seleccionarArchivo(event: Event) {
    const input = event.target as HTMLInputElement;
    this.archivo = input.files?.[0] || null;
  }

  guardar() {
    this.error.set(null);
    this.enviando.set(true);

    const formData = new FormData();
    formData.append('nombre', this.nombre);
    formData.append('anio', this.anio);
    formData.append('etiquetas', this.etiquetasSeleccionadas().join(','));
    if (!this.esEdicion) formData.append('tipo', this.tipo);
    if (this.archivo) formData.append('archivo', this.archivo);

    const peticion = this.esEdicion
      ? this.api.actualizarEntrada(this.id, formData)
      : this.api.crearEntrada(formData);

    peticion.subscribe({
      next: () => { this.enviando.set(false); this.router.navigate(['/admin']); },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(err.error?.error || 'Error al guardar');
        this.dialogoError.nativeElement.showModal();
      }
    });
  }

  cerrarModal() {
    this.dialogoError.nativeElement.close();
  }
}