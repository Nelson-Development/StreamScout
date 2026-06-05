-- user_services: tracks which streaming providers a user subscribes to
create table user_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider_id integer not null,
  unique(user_id, provider_id)
);

alter table user_services enable row level security;

create policy "Users manage their own services"
  on user_services for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- watchlist: stores saved movies/shows per user
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  movie_id integer not null,
  title text not null,
  poster_path text,
  media_type text check (media_type in ('movie', 'tv')) not null,
  created_at timestamptz default now(),
  unique(user_id, movie_id)
);

alter table watchlist enable row level security;

create policy "Users manage their own watchlist"
  on watchlist for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
