# Staging and preview (GitHub + Cloudflare Pages)

Dink Syndicate uses **preview URLs only** for staging — no separate custom domain.

## How Cloudflare Pages maps branches

| Git branch | Cloudflare behavior | URL |
|------------|---------------------|-----|
| **`main`** | **Production** deployment | `dinksyndicate.com` (and the project’s primary `*.pages.dev` URL) |
| **`staging`** (or any other branch) | **Preview** deployment | Unique URL per deploy, e.g. `https://abc123def.dink-syndicate.pages.dev` |

**Important:** The primary `*.pages.dev` hostname follows the **Production branch** (`main`), not a branch named `staging`. If you push only to `staging` but open the production Pages URL, you still see whatever is on `main`.

## One-time setup

### 1. Create the `staging` branch

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

### 2. Cloudflare Pages project settings

1. Open [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → your **Dink Syndicate** project.
2. **Settings** → **Builds & deployments**:
   - **Production branch:** `main`
   - **Preview deployments:** enable for all branches (or at least `staging`)
3. **Build configuration** (if not already set):
   - Build command: `npm run build`
   - Build output directory: `dist`

### 3. Find the staging preview URL

After each push to `staging`:

1. Pages → **Deployments**
2. Open the latest row for branch **`staging`**
3. Copy the **Preview** URL (hash-based, changes each deploy)

Use that URL to test new features before merging to production.

## Recommended workflow

```
feature/my-change  →  PR into staging  →  test on preview URL
                                        →  PR staging → main  →  production deploy
```

1. Branch from `staging` (or merge feature branches into `staging`).
2. Push to `staging` and test on the preview URL.
3. When confident, open a PR **`staging` → `main`** on GitHub and merge.
4. Production rebuilds automatically on `main`.

## Auto-update on deploy

Every production or preview deploy must bump the version in **all four places** (keep them in sync):

- `package.json` → `"version"`
- `src/config/constants.ts` → `APP_VERSION`
- `index.html` → `<meta name="app-version" content="…">`
- `sw.js` → `APP_VERSION` / `CACHE_NAME`

When users have the app open, it will detect the new version and **reload immediately** via:

1. Head script on load (cache clear + reload on upgrade)
2. Periodic server poll every 30 seconds when online
3. Service worker stale-while-revalidate on HTML navigations

## Firebase (when auth is enabled)

Add preview hostnames to Firebase **Authorized domains** if you sign in on staging previews:

- `*.pages.dev` preview URLs you use regularly
- `localhost`

Preview and Production can share one Firebase project, or use separate projects with different Cloudflare environment variables per environment.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Staging URL shows old UI | You opened the **production** URL instead of the latest **preview** URL from the `staging` deployment row |
| App never updates after deploy | Version not bumped in all four files above |
| Preview works, production doesn’t | Changes not merged to `main` yet |
