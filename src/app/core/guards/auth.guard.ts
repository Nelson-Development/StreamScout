import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';

export function authGuard(): boolean {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  if (!supabase.currentUser()) {
    router.navigate(['/auth']);
    return false;
  }
  return true;
}
