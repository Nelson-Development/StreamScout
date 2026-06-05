# Project Context: StreamFinder — Personal Streaming Service Aggregator

A personal web application that solves "streaming fatigue." Users search for movies/TV shows and see exactly which platform has it available, cross-referenced against their active streaming subscriptions in South Africa (ZA region).

## Tech Stack

- **Frontend:** Angular 21, standalone components, signals, lazy-loaded routes
- **Backend/Database/Auth:** Supabase (PostgreSQL + Auth)
- **External API:** TMDB (The Movie Database) API v3, using Bearer token auth

## Project Structure

```
src/
├── environments/
│   ├── environment.ts          ← Supabase URL/anonKey + TMDB readAccessToken
│   └── environment.prod.ts
└── app/
    ├── app.ts                  ← App shell with navbar, sign out
    ├── app.html                ← Navbar (hidden on auth page) + router-outlet
    ├── app.routes.ts           ← Lazy routes with functional authGuard
    ├── app.config.ts           ← provideRouter, provideHttpClient
    ├── services/
    │   ├── supabase.service.ts ← Supabase client, auth signal, user_services & watchlist CRUD
    │   └── tmdb.service.ts     ← TMDB search/multi, watch/providers (ZA), provider logo helpers
    └── components/
        ├── auth/               ← Sign in / sign up (toggleable)
        ├── settings/           ← Streaming service toggle grid, saves to user_services
        ├── search/             ← Debounced search, fetches ZA providers, highlights matches
        └── dashboard/          ← Watchlist split into "Ready to Watch" / "Not Available"
```

## Database (Supabase)

### `user_services`
| column | type | notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | → auth.users, cascade delete |
| provider_id | integer | TMDB provider ID |

RLS: users can only read/write their own rows.

### `watchlist`
| column | type | notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | → auth.users, cascade delete |
| movie_id | integer | TMDB media ID |
| title | text | |
| poster_path | text | |
| media_type | text | 'movie' or 'tv' |
| created_at | timestamptz | default now() |

RLS: users can only read/write their own rows.

Migration: `supabase/migrations/20260603000000_initial_schema.sql`

## Key Implementation Details

- Auth state is held in a `signal<User | null>` on `SupabaseService`, subscribed via `onAuthStateChange`.
- The `authGuard` is a functional guard that reads the signal and redirects to `/auth` if null.
- Search uses RxJS `debounceTime(400)` + `distinctUntilChanged` → `switchMap` into `forkJoin` of per-result provider lookups.
- Provider matching: `availableOn.some(p => userProviderIds.includes(p.provider_id))`.
- All TMDB image URLs use `https://image.tmdb.org/t/p/w500`.
- ZA streaming providers hardcoded in `SettingsComponent` with TMDB provider IDs.

## Known Issues

- Disney+ provider ID (337) may not match the ID TMDB returns for the ZA region — needs verification against `GET /watch/providers/movie?watch_region=ZA`.

## Running Locally

```bash
cd /Users/danielnelson/Desktop/Hackathon
npx ng serve
```

App runs at `http://localhost:4200`.
