# DollarMind

DollarMind — an offline-first smart finance management app (pilot), on a path to
a compliant multi-tenant SaaS. Single local user for now.

## Documentation

Design docs live in [`docs/`](docs/) and are the source of truth:

| Doc | What it covers |
|---|---|
| [requirements.md](docs/requirements.md) | Product requirements, MVP vs. phases, user flows |
| [architecture.md](docs/architecture.md) | Technical architecture, stack, parser/engine design |
| [security.md](docs/security.md) | Auth model, threat model, audit & compliance |
| [data-model.md](docs/data-model.md) | Canonical data model (SQLite + PostgreSQL) |

## Brand & identifiers

| Item | Value |
|---|---|
| App name | **DollarMind** |
| Bundle / app id | `com.dollarmind.app` |
| npm packages | `dollarmind-frontend`, `dollarmind-backend` |
| Env var prefix | `DOLLARMIND_*` (legacy unprefixed names still read as fallback) |
| Brand assets | [`frontend/dollarmind-assets/`](frontend/dollarmind-assets/) |
| Theme tokens | [`frontend/src/dollarmind-theme/`](frontend/src/dollarmind-theme/) |

## Repository structure

```
dollarmind/
├── docs/                     # Design docs (source of truth)
├── backend/                  # Express + TypeScript API (SQLite via node:sqlite)
│   └── src/{config, db, models, parsers, repositories, services, controllers, routes, utils, tests}
├── frontend/                 # React + Vite + TypeScript (DollarMind UI)
│   ├── src/
│   │   ├── dollarmind-theme/ # Design tokens (theme.ts)
│   │   ├── components/{brand, layout, ui, ...}
│   │   ├── context/          # Auth + Preferences
│   │   ├── pages/            # Dashboard, Salary, Statements, Spending, Settings, ...
│   │   └── ...
│   ├── dollarmind-assets/    # App icon + splash sources (icon.svg, splash.svg)
│   ├── public/               # dollarmind-icon.svg, manifest.json
│   ├── capacitor.config.ts   # Native packaging (appId com.dollarmind.app)
│   └── android/              # Generated Capacitor Android platform
├── config/                   # Runtime JSON config
├── db/                       # schema.sql + migrations/
└── scripts/                  # migrate.ts, seed.ts
```

## Getting started

```bash
# Backend
cd backend && npm install && npm run migrate && npm run dev   # http://localhost:4000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev                     # http://localhost:5173
```

## Mobile packaging (Capacitor)

```bash
cd frontend
npm run build
npx cap sync android
npx cap open android         # build the APK in Android Studio
```

See [`frontend/dollarmind-assets/README.md`](frontend/dollarmind-assets/README.md)
for generating the app icon and splash from the DollarMind logo.

## Status

Phases 1–12 complete: PRD/architecture/security/data-model, auth + sessions,
salary + statement ingestion, deduplication, categorization + spending trends,
manual expenses + cash tracking, settings/preferences, and the DollarMind
UI/UX design system with cross-platform (Capacitor-ready) packaging.
