import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';
  error: string | null = null;
  enviando = false;

  constructor(private auth: Auth, private router: Router) {}

  login() {
    this.error = null;
    this.enviando = true;
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.enviando = false;
        this.router.navigate(['/admin']);
      },
      error: (err) => {
        this.enviando = false;
        this.error = err.status === 401 ? 'Credenciales incorrectas' : 'No se pudo conectar con el servidor';
      }
    });
  }
}