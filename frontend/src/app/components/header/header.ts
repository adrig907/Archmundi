import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule, NgIf],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  busqueda = '';

  constructor(private router: Router, public auth: Auth) {}

  buscar() {
    if (this.busqueda.trim()) {
      this.router.navigate(['/buscar'], { queryParams: { q: this.busqueda.trim() } });
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}