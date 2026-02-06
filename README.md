# Nefesh — Coming Soon

Nefesh is the minimalist “heartbeat” of Jewish home life: a calm, iconic place you open daily to stay oriented to Shabbat, the weekly parsha, and the Jewish calendar, plus a private memories hub for Jewish moments.

## Features (MVP)
- **Home dashboard:** Shabbat countdown, parsha, next holiday
- **Local-only Memories:** Albums stored in the browser (IndexedDB)
- **Settings:** Location, diaspora/Israel, candle lighting & havdalah presets
- **Dark-first UI:** Premium, minimal, modern
- **Offline resilience:** Last-known values cached locally

## Data Sources
- **Hebcal API** for Shabbat times, parsha, and holidays
- **Open‑Meteo Geocoding** for city/ZIP lookup

## Run locally
```bash
python3 -m http.server 8080
# or
npx serve .
```
Open: http://localhost:8080

## Deploy to GitHub Pages
1. Push to `main` branch
2. In GitHub repo → Settings → Pages
3. Source: **Deploy from a branch**
4. Branch: `main` / root
5. Save

Live URL:
```
https://<username>.github.io/nefesh-site/
```

## Notes
- Times are based on your local timezone and coordinates
- Memories are stored locally and never uploaded
- No accounts required for MVP

---

**Nefesh** — The calm, daily heartbeat of Jewish home life.
