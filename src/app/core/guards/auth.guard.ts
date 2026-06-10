import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';

export async function authGuard(): Promise<boolean> {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  await supabase.waitForSession();
  if (!supabase.currentUser()) {
    router.navigate(['/auth']);
    return false;
  }
  return true;
}
