# Dink Syndicate: Launch Plan

> Reference document for agents and contributors.  
> Domain: **dinksyndicate.com** | Stack: **Cloudflare Pages PWA** + **Firebase (Phase 2+)** + **DUPR RaaS (Phase 3)**

---

## Overview

Modular **offline-first** pickleball PWA in sibling folder `Dink Syndicate/` (outside SmashSyndicate repo).

| Phase | Scope |
|-------|--------|
| **Phase 1** | Local-only queue manager — no Firebase, no DUPR API |
| **Phase 2** | Firebase Auth + optional cloud sync when online |
| **Phase 3** | Full [DUPR RaaS](https://dupr.gitbook.io/dupr-raas) partner integration |
| **Phase 4** | Tournaments, wallboard, finance, session registration app |

**Non-negotiable:** Offline-first — full club session with zero internet after first load (same philosophy as Smash Syndicate).

---

## Bottom line: how hard is this?

**Moderate effort, not a rewrite.** For MVP scope (players, courts, queue, basic stats — no tournaments/premium), expect roughly **3–6 weeks** by **porting tested modules** from `SmashSyndicate/public/src/` into a **new modular scaffold** — **not** by copying the ~35k-line `SmashSyndicate/public/index.html`.

What makes it harder than a simple rebrand:

- Pickleball court visuals and copy pass
- Modular greenfield scaffold (avoids Smash’s monolith)
- DUPR RaaS official integration deferred to Phase 3
- No RecClub public API

What you can defer: Firebase Auth (Phase 2), DUPR RaaS (Phase 3), tournaments, premium, wallboard, finance, smash125-style session app.

---

## Project location

Dink Syndicate **does not** live inside SmashSyndicate:

```
C:\Users\USER\OneDrive\Documents\GitHub\
├── SmashSyndicate\          ← existing badminton app (unchanged)
└── Dink Syndicate\          ← new pickleball PWA (separate project)
    ├── DINK-SYNDICATE-LAUNCH-PLAN.md   ← this file
    ├── index.html
    ├── src/
    ├── dist/
    └── package.json
    # Phase 2 adds: firebase.json, firebase-functions/, src/config/firebase.ts
```

- Separate git repo and GitHub remote
- Source logic **ported selectively** from `SmashSyndicate/public/src/` — **never** copy `index.html` monolith

---

## Offline-first philosophy (mandatory)

**The device is the source of truth; the network is optional.**

| Pattern | Smash Syndicate | Dink Syndicate |
|---------|-----------------|----------------|
| Session data | `localStorage` primary | Same Phase 1; Phase 2 adds optional cloud backup |
| App shell offline | `sw.js` precaches JS/CSS/icons | Port SW strategy into modular `public/sw.js` |
| Refresh | Reload without unregistering SW | Same rule |
| Cross-device without cloud | JSON export/import | Include in Phase 1 MVP |
| Cloud sync | Upload/Download — user-initiated | Phase 2 only |

### Offline-first rules (all phases)

1. **No network required** for: players, check-in, queue, courts, record winners, stats, settings, export JSON.
2. **localStorage writes are immediate** — UI never waits on network for core actions.
3. **Service worker** precaches full app shell after first visit.
4. **Graceful degradation** — Phase 2/3 features show “needs connection”; core queue keeps working.
5. **Phase 2 cloud sync is additive** — local wins during active session.

### Offline QA checklist (Phase 1 sign-off)

- [ ] Load once online, airplane mode — full session runnable
- [ ] 8 players, 4 matches, stats persist after offline reload
- [ ] Reopen from home screen — data intact
- [ ] Deploy new version — local session not wiped
- [ ] Export/import JSON offline — session restored

---

## Modular architecture (mandatory)

**Do not repeat Smash Syndicate’s ~35,000-line `index.html` with inline script.**

Smash has modules under `public/src/` wired through LegacyBridge adapters. Dink Syndicate must be modular from day one.

### Anti-patterns to avoid

| Anti-pattern | Dink Syndicate rule |
|--------------|---------------------|
| Business logic in HTML | **Zero** business logic in `index.html` |
| Global state (`window.addToQueue`) | **Zustand stores** + typed services |
| Bridge-on-bridge | **Direct imports** module → store → UI |
| Untestable UI | Pure services + small view modules |
| File size creep | **Max ~400 lines/file** (ESLint) |

### Target folder structure

```
Dink Syndicate/
├── index.html                 ← thin shell only (~100 lines max)
├── src/
│   ├── main.ts                ← bootstrap app, register SW
│   ├── app/
│   │   ├── bootstrap.ts       ← init stores, router (Firebase Phase 2)
│   │   └── router.ts          ← tab/screen navigation
│   ├── config/
│   │   ├── firebase.ts        ← Phase 2
│   │   └── constants.ts
│   ├── types/                 ← player, match, queue, court, dupr (Zod)
│   ├── stores/                ← Zustand: sessionStore, playerStore, queueStore, courtStore
│   ├── services/              ← localStorage; Phase 2 adds FirebaseSyncService
│   ├── modules/
│   │   ├── auth/              ← AuthProvider; LocalSessionService (P1), FirebaseAuthService (P2)
│   │   ├── players/
│   │   ├── courts/            ← pickleball SVG renderer
│   │   ├── queue/             ← QueueService, MatchService, DUPR balance
│   │   ├── match/
│   │   └── dupr/              ← DuprProvider stub (P1); RaaS (P3)
│   ├── ui/
│   │   ├── components/
│   │   ├── screens/
│   │   └── render.ts
│   └── lib/                   ← version-check, offline-utils
├── css/
├── public/                    ← manifest, sw.js, icons
├── tests/
└── scripts/
    └── check-no-monolith.mjs  ← fail build if index.html inline script > 80 lines
```

### Layer rules

- **`modules/`** — pure logic, no DOM
- **`stores/`** — app state; UI subscribes here
- **`ui/`** — renders from store; calls actions on events
- **`index.html`** — meta, `#app`, theme flash, one `<script type="module" src="/src/main.ts">`

### Port from Smash (reuse logic, not structure)

**Copy/adapt:**

- `SmashSyndicate/public/src/modules/players/`
- `SmashSyndicate/public/src/modules/queue/QueueService.js`, `MatchService.js`
- `SmashSyndicate/public/src/modules/match/`
- `SmashSyndicate/public/src/storage-scope.js`
- `SmashSyndicate/public/src/services/StorageService.js`, `BaseService.js`

**Do NOT copy:**

- Inline script in `index.html`
- `*-integration.js` bridge files
- LegacyBridge classes
- Tournament modules (deferred)

**Defer to Phase 2:** `AuthService.js`, Firebase SDK, Firestore sync

### Phase 1 auth model (no Firebase)

- Local session ID on first visit
- Optional organizer display name
- Single-device data under `dinksyndicate_*` keys
- Export/import JSON for device portability
- `AuthProvider` interface for Phase 2 swap-in:

```typescript
interface AuthProvider {
  getSession(): Session | null;
  signIn(): Promise<Session>;      // Phase 2: Google / email
  signOut(): Promise<void>;
  onSessionChange(cb): Unsubscribe;
}
```

### Enforcement guardrails

1. `check-no-monolith.mjs` — fail if `index.html` inline script > 80 lines
2. ESLint `max-lines` — error at 400
3. Ban `window.*` global assignments for app state
4. Jest — at least one test per `modules/*/` folder
5. TypeScript strict + Zod at storage boundaries

### Tech stack

| Piece | Choice |
|-------|--------|
| Build | Vite 5 + TypeScript |
| State | Zustand |
| Validation | Zod |
| UI | Vanilla TS + scoped CSS |
| Persistence | localStorage (P1); Firestore sync optional (P2) |
| PWA | Service worker, installable, airplane-mode capable |
| Tests | Jest + jsdom |

---

## DUPR RaaS integration — feasibility and phasing

**Verdict: Yes, it is possible.** [DUPR RaaS](https://dupr.gitbook.io/dupr-raas) is built for third-party pickleball apps. **Phase 3 only** — not Phase 1 or 2.

### DUPR mandatory requirements (production approval ~10 business days)

| Requirement | Docs | Complexity |
|-------------|------|------------|
| SSO Login (iframe OAuth) | [sso-login](https://dupr.gitbook.io/dupr-raas/integration-checklist/sso-login.md) | Medium — **manual DUPR ID prohibited for partners** |
| Ratings & Webhooks | [ratings-and-webhooks](https://dupr.gitbook.io/dupr-raas/integration-checklist/ratings-and-webhooks.md) | High — HTTPS backend |
| User Gating | [user-gating](https://dupr.gitbook.io/dupr-raas/integration-checklist/user-gating.md) | Medium — `BASIC_L1` entitlement |
| Match Upload & Management | [match-upload](https://dupr.gitbook.io/dupr-raas/integration-checklist/match-upload-and-management.md) | High — **per-game scores required** |
| Club Integration (optional) | [club-integration](https://dupr.gitbook.io/dupr-raas/integration-checklist/club-integration.md) | Medium |
| Partner tokens | Server-side only | Cloud Functions |
| Integration review | Email `tech@mydupr.com` | ~10 business days |

### Why Phase 3

- Phase 1 manual ratings = local queue only (not partner-compliant)
- Webhooks + partner secrets need Firebase Functions (Phase 2 infrastructure)
- MVP winner-button insufficient — DUPR needs game-by-game scores
- Offline queue still works; DUPR sync when online

### Three-tier DUPR strategy

**Phase 1 — Local rating fields (not official DUPR)**

- Organizer enters `duprDoublesRating` / `duprSinglesRating`
- UI: *"Rating for queue (organizer-entered)"*
- `DuprProvider` interface stubbed

**Phase 2 — Firebase (no DUPR yet)**

- Auth + Firestore sync
- Cloud Functions scaffold with empty `dupr/` routes

**Phase 3 — Full DUPR RaaS**

1. Partner onboarding → UAT keys
2. SSO iframe + `postMessage`
3. Webhook receiver for `RATING` / `RATING_SEED`
4. Cache ratings locally for offline queue
5. Match create/update/delete with game scores
6. Entitlement gating
7. Optional club linking
8. Integration review → production keys

### Design for Phase 3 from day one

```typescript
interface PlayerDuprProfile {
  duprId?: string;
  duprDoublesRating?: number;
  duprSinglesRating?: number;
  duprConnected: boolean;
  duprLastSyncedAt?: number;
  duprRatingSource: 'manual' | 'dupr_sso' | 'dupr_webhook';
}

interface MatchDuprMeta {
  duprIdentifier?: string;
  duprMatchCode?: string;
  duprUploadStatus?: 'pending' | 'uploaded' | 'failed';
  gameScores?: { teamA: number[]; teamB: number[] };
}

interface DuprProvider {
  connectPlayer(): Promise<void>;
  getRating(duprId: string): Promise<Rating>;
  submitMatch(match: MatchDuprMeta): Promise<void>;
  onRatingUpdate(cb): Unsubscribe;
}
```

Backend (Phase 3): `firebase-functions/dupr/` — token, webhook, matches, SSO token storage.

**RecClub:** No public API. Use DUPR RaaS directly.

---

## Architecture by phase

### Phase 1 — local-first (no Firebase)

- Cloudflare Pages → static PWA
- All data in scoped `localStorage`
- Service worker app shell

### Phase 2 — Firebase Auth + cloud sync

- Separate Firebase project (not Smash Syndicate)
- Google + email auth
- Firestore `userData/{uid}` — optional sync when online
- Functions scaffold for Phase 3 DUPR

### Phase 3 — DUPR RaaS

- SSO iframe, webhooks, match upload via Cloud Functions
- Requires Phase 2 backend

| Concern | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| Auth | Local session | Firebase Auth | + DUPR SSO |
| Data | localStorage | Firestore sync optional | + DUPR cache, upload queue |
| Offline | 100% core features | Same | Same |
| DUPR | Organizer-entered ratings | Manual; start partner onboarding | Official RaaS |
| Firebase | Not used | New project | + DUPR Functions |

---

## Sport-specific changes (pickleball MVP)

| Area | Change |
|------|--------|
| Branding | Dink Syndicate, logo, `dinksyndicate_*` keys |
| Court SVG | Pickleball court + kitchen/non-volley zone |
| Icons | Pickleball paddle (not badminton) |
| Skill system | DUPR-style numeric ratings (manual P1; live P3) |
| Scoring | Winner-button for MVP; game scores for Phase 3 DUPR upload |
| Finance | Defer |

---

## Strip for MVP

Do not port: tournament mode, Syndicate Partner/PayMongo, wallboard, admin portal, session summary PNG, smash125 sync.

---

## Phased rollout

### Phase 0 — Foundation (week 1)

- [ ] Create modular scaffold (Vite + TS + Zustand)
- [ ] Thin `index.html` + `src/main.ts`
- [ ] `AuthProvider` + `LocalSessionService`
- [ ] Service worker + versioned cache
- [ ] Port core modules (players, queue, match, storage-scope)
- [ ] `check-no-monolith.mjs` + ESLint max-lines
- [ ] `git init` + GitHub repo
- [ ] Cloudflare Pages → `dinksyndicate.com`
- [ ] Branding + `dinksyndicate_*` namespace

### Phase 1 — MVP core (weeks 2–3)

- [ ] Players, courts, queue, stats — 100% offline
- [ ] Pickleball court SVG + copy
- [ ] Organizer-entered DUPR-style ratings for queue
- [ ] `DuprProvider` stub in `modules/dupr/`
- [ ] Session export/import JSON
- [ ] Airplane-mode QA sign-off
- [ ] PWA install + SW on production domain

### Phase 2 — Firebase (when ready)

- [ ] New Firebase project
- [ ] Firebase Auth (Google + email)
- [ ] Firestore sync; migrate local data on first login
- [ ] Storage for branding assets
- [ ] Cloud Functions scaffold (`dupr/` routes empty)
- [ ] Test auth on preview + production
- [ ] *(Optional: email tech@mydupr.com for DUPR partner onboarding)*

### Phase 3 — DUPR RaaS

- [ ] UAT integration per [dupr.gitbook.io/dupr-raas](https://dupr.gitbook.io/dupr-raas)
- [ ] SSO iframe
- [ ] Webhook receiver + rating cache
- [ ] Game-by-game score capture UI
- [ ] Match create/update/delete
- [ ] Entitlement gating
- [ ] Optional club linking
- [ ] Integration review → production keys

### Phase 4 — Post-MVP

- [ ] Finance / ball-cost sharing
- [ ] Live wallboard
- [ ] Tournament brackets (11 win-by-2)
- [ ] Session registration companion (smash125-style)

---

## Cloudflare Pages (Phase 1)

- Build: `npm run build` → output `dist`
- Custom domain: `dinksyndicate.com`
- Copy `_redirects` SPA pattern from `SmashSyndicate/public/_redirects`
- No Firebase env vars until Phase 2

## Firebase setup (Phase 2)

1. Auth (Google + email), Firestore, Storage, Functions
2. Authorized domains: `dinksyndicate.com`, `www`, `*.pages.dev`, `localhost`
3. Firestore rules: uid-scoped `userData/{uid}`
4. Storage rules + CORS for dinksyndicate.com
5. Migration: import localStorage on first sign-in
6. Sync: local-first; background upload when online
7. Functions scaffold for Phase 3 DUPR
8. Firebase config via Cloudflare env vars
9. Blaze plan + budget alerts

## DUPR RaaS setup (Phase 3)

1. Email `tech@mydupr.com` → UAT `clientKey` / `clientSecret`
2. SSO iframe (prod: `dashboard.dupr.com/login-external-app/:clientKey`)
3. HTTPS webhook; register; handle `RATING` + `RATING_SEED`
4. Subscribe players on roster connect
5. Match CRUD with per-game scores
6. `BASIC_L1` gating; optional `PREMIUM_L1`
7. Optional club role verification
8. Score capture UI (prerequisite)
9. Integration review (~10 business days)
10. Never store `clientSecret` in PWA

---

## Risk summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| DUPR RaaS complexity | High — Phase 3 | Stub `DuprProvider` P1; score capture UI is main new work |
| DUPR partner approval delay | Low until P3 | Manual ratings in P1; start UAT onboarding in P2 |
| Monolithic index.html | Eliminated | Modular scaffold + CI guardrails |
| Firebase auth misconfig | N/A until P2 | Test on preview before production |
| Local-only data loss | Medium P1 | Export/import JSON; warn users |
| SW cache stale after deploy | Medium | Version bump + app-version meta |
| Feature creep | Medium | DUPR = P3; tournaments = P4 |

---

## Agent task checklist (summary)

| ID | Task | Phase |
|----|------|-------|
| scaffold-modular | Modular src/ layout, thin index.html | 0 |
| local-auth-layer | LocalSessionService + AuthProvider | 0 |
| offline-first-pwa | SW, localStorage, airplane-mode test | 0–1 |
| port-core-modules | Port Smash modules (no Firebase auth yet) | 0–1 |
| anti-monolith-guardrails | CI line limits, no inline business logic | 0 |
| cloudflare-pages | Deploy to dinksyndicate.com | 0 |
| pickleball-ux | Court SVG, copy, manual ratings | 1 |
| dupr-provider-stub | DuprProvider interface + types | 1 |
| mvp-qa | PWA install, offline session QA | 1 |
| firebase-project | New Firebase project | 2 |
| firebase-auth-sync | Auth + local-first Firestore sync | 2 |
| dupr-partner-apply | Email tech@mydupr.com | 2–3 prep |
| dupr-raas-integration | Full DUPR partner checklist | 3 |

---

## Recommendation

**Do it.** Phase 1 as offline-first PWA on Cloudflare Pages is the fastest path to a working queue manager on `dinksyndicate.com`.

**Design for Phase 2 and 3 from day one** via `AuthProvider` and `DuprProvider` — never required mid-session offline.

**Never copy** Smash `index.html` monolith or LegacyBridge pattern.

---

*Last updated: June 2026 — synthesized from Dink Syndicate planning session.*
