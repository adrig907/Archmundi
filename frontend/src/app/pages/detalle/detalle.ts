import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { ApiService, EntradaDetalle } from '../../services/api';

@Component({
  selector: 'app-detalle',
  standalone: true,
  imports: [NgIf, RouterLink],
  templateUrl: './detalle.html',
  styleUrl: './detalle.css'
})
export class Detalle implements OnInit {
  entrada = signal<EntradaDetalle | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.api.obtenerEntrada(id).subscribe({
      next: (datos) => { this.entrada.set(datos); this.cargando.set(false); },
      error: (err) => {
        this.error.set(err.status === 404 ? 'Esta entrada no existe' : 'No se pudo conectar con el servidor');
        this.cargando.set(false);
        console.error(err);
      }
    });
  }
}