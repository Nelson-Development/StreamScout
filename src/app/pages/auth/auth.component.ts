import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  email = '';
  password = '';
  isSignUp = signal(false);
  loading = signal(false);
  errorMessage = signal('');

  async submit() {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      if (this.isSignUp()) {
        const { error } = await this.supabase.signUp(this.email, this.password);
        if (error) throw error;
        this.errorMessage.set('Check your email to confirm your account.');
      } else {
        const { error } = await this.supabase.signIn(this.email, this.password);
        if (error) throw error;
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message ?? 'Something went wrong.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleMode() {
    this.isSignUp.update((v) => !v);
    this.errorMessage.set('');
  }
}
