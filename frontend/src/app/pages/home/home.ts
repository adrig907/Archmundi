import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, NgFor],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  opciones = [
    { etiqueta: 'Fotos', ruta: '/listado/foto' },
    { etiqueta: 'Archivo', ruta: '/listado/documento' },
    { etiqueta: 'Videos', ruta: '/listado/video' },
    { etiqueta: 'Fiestas', ruta: '/etiqueta/fiestas' },
    { etiqueta: 'Asociaciones', ruta: '/etiqueta/asociaciones' },
  ];
}