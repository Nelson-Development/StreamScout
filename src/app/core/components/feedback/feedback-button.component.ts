import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '@core/services/supabase.service';

@Component({
  selector: 'app-feedback-button',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './feedback-button.component.html',
  styleUrl: './feedback-button.component.scss',
})
export class FeedbackButtonComponent {
  private supabase = inject(SupabaseService);

  open     = signal(false);
  message  = signal('');
  sending  = signal(false);
  sent     = signal(false);

  toggle() { this.open.update(v => !v); }

  close() {
    this.open.set(false);
    // Reset after close animation
    setTimeout(() => { this.message.set(''); this.sent.set(false); }, 300);
  }

  async submit() {
    const text = this.message().trim();
    if (!text) return;
    const user = this.supabase.currentUser();
    if (!user) return;

    this.sending.set(true);
    try {
      await this.supabase.submitFeedback(user.id, text);
      this.sent.set(true);
      this.message.set('');
      setTimeout(() => this.close(), 1800);
    } catch {
      // silently fail — user can retry
    } finally {
      this.sending.set(false);
    }
  }
}
