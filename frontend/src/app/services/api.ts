import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Entrada {
  Id: string;
  Nombre: string;
  Anio: number;
  Tipo: string;
  Descripcion: string | null;
  RutaMiniatura: string | null;
  RutaArchivo: string | null;
  Etiquetas: string | null;
}


export interface EntradaDetalle extends Entrada {
  detalle: {
    RutaArchivo: string;
    Formato: string;
    AnchoPx?: number;
    AltoPx?: number;
    DuracionSeg?: number;
    NumPaginas?: number;
  } | null;
  etiquetas: string[];
}

export interface Etiqueta {
  Id: string;
  Nombre: string;
  ParentId: string | null;
  subcategorias?: Etiqueta[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  listarEntradas(filtros: { tipo?: string; etiqueta?: string; anio?: string } = {}): Observable<Entrada[]> {
    let params = '';
    const entradas = Object.entries(filtros).filter(([, v]) => v);
    if (entradas.length) {
      params = '?' + entradas.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
    }
    return this.http.get<Entrada[]>(`${this.baseUrl}/entradas${params}`);
  }

    obtenerEntrada(id: string): Observable<EntradaDetalle> {
    return this.http.get<EntradaDetalle>(`${this.baseUrl}/entradas/${id}`);
  }

    crearEntrada(formData: FormData) {
    return this.http.post(`${this.baseUrl}/entradas`, formData);
  }

  actualizarEntrada(id: string, formData: FormData) {
    return this.http.put(`${this.baseUrl}/entradas/${id}`, formData);
  }

  borrarEntrada(id: string) {
    return this.http.delete(`${this.baseUrl}/entradas/${id}`);
  }

    listarEtiquetas(): Observable<Etiqueta[]> {
    return this.http.get<Etiqueta[]>('/api/etiquetas');
  }

  crearEtiqueta(nombre: string, parentId?: string) {
    return this.http.post('/api/etiquetas', { nombre, parentId });
  }

  borrarEtiqueta(id: string) {
    return this.http.delete(`/api/etiquetas/${id}`);
  }
}