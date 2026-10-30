import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { ApiService, Entrada } from '../../services/api';

@Component({
  selector: 'app-listado',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './listado.html',
  styleUrl: './listado.css'
})
export class Listado implements OnInit {
  entradas = signal<Entrada[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);
  titulo = '';

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    const tipo = this.route.snapshot.paramMap.get('tipo');
    const etiqueta = this.route.snapshot.paramMap.get('nombre');

    const filtro = tipo ? { tipo } : { etiqueta: etiqueta! };
    this.titulo = tipo || etiqueta || '';

    this.api.listarEntradas(filtro).subscribe({
      next: (datos) => { this.entradas.set(datos); this.cargando.set(false); },
      error: (err) => {
        this.error.set('No se pudo conectar con el servidor');
        this.cargando.set(false);
        console.error(err);
      }
    });
  }
}