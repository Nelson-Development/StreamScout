# StreamScout

StreamScout is a static website for browsing what is on the streaming services you actually subscribe to. The default region is South Africa. Pick your services, then browse trending, popular, and top-rated movies and series, search for a title, and keep a watchlist on this device.

There is no account and no server. Chosen services and the watchlist live in the browser.

## Run it

Requires Node.js 22.22 or newer (Angular CLI 22).

```bash
npm ci
npm start
```

Open http://localhost:4200/.

Production build:

```bash
npm run build
```

The static files are written to `dist/streamfinder/browser`. Any static host works. `vercel.json` and `public/_redirects` send unknown paths back to `index.html` so client-side routes keep working.

## How data is stored

Everything is under the localStorage key `ss:v1`:

- region (default `ZA`)
- selected streaming service ids
- watchlist entries, keyed by media type and TMDB id so a movie and a series that share an id do not collide

Adding a title that is already on the watchlist does nothing.

### Move your library

On Settings:

- **Export JSON** downloads `streamscout-library.json`.
- **Import JSON** replaces the services and watchlist on this device.
- **Copy share link** puts the same snapshot in the URL hash (`#s=...`). Opening that link on another device replaces the library there, then the hash is removed. Large watchlists make a long link; use the JSON file if the link is unwieldy.

## TMDB

Catalogue, posters, genres, and streaming providers come from [TMDB](https://www.themoviedb.org/). The read token is in `src/environments/environment.ts` (and `environment.prod.ts` for production builds). It is a public read-only key and is shipped in the browser bundle.

Provider lists for the settings picker come from TMDB's live `/watch/providers` results for the selected region (movies and series combined). Responses are cached in the browser: genres for 7 days, provider lists and per-title providers for 24 hours, browse rows for 6 hours, and search for 1 hour.

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming provider data is supplied by JustWatch.

Disney+ in South Africa is not listed by TMDB's ZA catalogue. The app keeps its existing fallback: Disney+ is offered in the picker, and availability falls back to global presence. That behaviour is intentional.

## Missing posters

Titles without a poster use `assets/no-poster.png`. If that image also fails, the page does not retry it in a loop.
