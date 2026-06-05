import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '@environments/environment';

export interface UserService {
  id?: string;
  user_id: string;
  provider_id: number;
}

export interface WatchlistItem {
  id?: string;
  user_id: string;
  movie_id: number;
  title: string;
  poster_path: string;
  media_type: 'movie' | 'tv';
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  currentUser = signal<User | null>(null);

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );

    this.supabase.auth.getSession().then(({ data }) => {
      this.currentUser.set(data.session?.user ?? null);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  // Auth
  signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  signUp(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  // User services (subscriptions)
  async getUserServices(userId: string): Promise<number[]> {
    const { data, error } = await this.supabase
      .from('user_services')
      .select('provider_id')
      .eq('user_id', userId);
    if (error) throw error;
    return data.map((row: { provider_id: number }) => row.provider_id);
  }

  async setUserServices(userId: string, providerIds: number[]): Promise<void> {
    // Delete existing and re-insert
    const { error: deleteError } = await this.supabase
      .from('user_services')
      .delete()
      .eq('user_id', userId);
    if (deleteError) throw deleteError;

    if (providerIds.length === 0) return;

    const rows = providerIds.map((provider_id) => ({ user_id: userId, provider_id }));
    const { error } = await this.supabase.from('user_services').insert(rows);
    if (error) throw error;
  }

  // Watchlist
  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    const { data, error } = await this.supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as WatchlistItem[];
  }

  async addToWatchlist(item: WatchlistItem): Promise<void> {
    const { error } = await this.supabase.from('watchlist').insert(item);
    if (error) throw error;
  }

  async removeFromWatchlist(userId: string, movieId: number): Promise<void> {
    const { error } = await this.supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('movie_id', movieId);
    if (error) throw error;
  }
}
