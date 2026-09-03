# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project

**NEX Operator** — an internal web dashboard for transit operators / operations managers to
monitor a live bus fleet and manage conductors, buses, routes, passenger feedback, lost‑item
reports and end‑of‑trip reports for a Cavite (Philippines) bus network.

It is a **staff‑only tool**. Accounts are provisioned by the team directly in Firebase — there
is **no sign‑up, no password reset, no public access**. A user may only reach the dashboard by
signing in with an email/password that already exists in the project's Firebase Authentication.

## Tech stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------ |
| UI framework   | React 19 (`react`, `react-dom`)                              |
| Build tool     | Vite 8 (`npm run dev` / `build` / `preview`)                 |
| Styling        | Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config`; `src/index.css` is just `@import "tailwindcss";`) |
| Routing        | `react-router-dom` v7                                        |
| Icons          | `lucide-react` (used everywhere — do not introduce another icon set) |
| Maps           | `@react-google-maps/api` (`GoogleMap`, `useJsApiLoader`, `MarkerF`) |
| Auth / data    | `firebase` v12 — Auth wired for login; Realtime DB / Firestore for fleet data not integrated yet |
| Lint           | ESLint 10 flat config (`eslint.config.js`), `npm run lint`   |
| Language       | Plain JavaScript + JSX (no TypeScript)                       |

## Commands

```bash
npm install        # first-time setup
npm run dev         # Vite dev server (default http://localhost:5173)
npm run build       # production build to dist/
npm run preview     # serve the production build
npm run lint        # ESLint over **/*.{js,jsx}
```

There is no test runner configured.

## Repository layout

```
src/
  main.jsx                     # React entry — mounts <App/>, imports index.css
  App.jsx                      # BrowserRouter + <AuthProvider> + route table
  index.css                    # Tailwind entrypoint (single @import line)
  lib/
    firebase.js                # initializeApp + getAuth from VITE_PUBLIC_FIREBASE_* env
  context/
    AuthContext.jsx            # <AuthProvider> + useAuth() — user, loading, signIn, signOut
  (operator)/                  # route-group folder for authenticated operator pages
    OperatorLogin.jsx          # login screen (standalone, not wrapped in MainLayout)
    Dashboard.jsx              # "Fleet Overview" — stat cards + Google Map
    ManageConductors.jsx       # conductor table (mock data)
    ManageBus.jsx              # placeholder page
    ManageRoute.jsx            # placeholder page
    PassengerFeedback.jsx      # placeholder page
    LostItemReports.jsx        # placeholder page
    EndOfTripReports.jsx       # placeholder page
    AccountSettings.jsx        # shows signed-in user + sign out
  components/
    MainLayout.jsx             # shared sidebar + header shell for every operator page
    ProtectedRoute.jsx         # auth gate — splash while loading, redirect to /login if signed out
    PagePlaceholder.jsx        # "coming soon" empty-state body for unbuilt pages
  assets/                      # Vite starter leftovers (react.svg, vite.svg, hero.png)
  App.css                      # Vite starter leftover — unused, safe to delete
public/
  favicon.svg, icons.svg
.env                           # gitignored — Firebase + Google Maps keys (see "Environment")
.env.example                   # committed template
```

No `import React from 'react'` — the project relies on React 19's automatic JSX runtime.
Import hooks by name (`import { useState } from 'react'`).

The `(operator)` parenthesised folder name is a **route‑group convention** (borrowed from
Next.js): it groups the authenticated pages without affecting URLs. Keep new authenticated
pages here.

## The shared layout — `src/components/MainLayout.jsx`

**Every authenticated page renders its content inside `<MainLayout>`.** Do not re‑implement
the sidebar or header per page — that is the whole point of this component.

```jsx
import MainLayout from '../components/MainLayout';

export default function ManageBus() {
  return (
    <MainLayout pageTitle="Bus Management" pageSubtitle="Register and assign fleet vehicles.">
      {/* page body only */}
    </MainLayout>
  );
}
```

Props:

| Prop          | Purpose                                                       |
| ------------- | ------------------------------------------------------------ |
| `pageTitle`   | large bold heading rendered above the page body              |
| `pageSubtitle`| muted one‑line description under the title                   |
| `children`    | the page body; laid out in a vertical flex column with `gap-6`, scrollable |

`MainLayout` owns:
- the fixed **256px sidebar** (`w-64`, `bg-[#edf1f7]`) with the "NEX Dashboard" wordmark, the
  nav list, an "Account Settings" link (`/settings`) and a "Sign Out" button (`signOut()` →
  redirect to `/login`);
- the **64px top header** (`h-16`) with a notification bell (unread red dot) and the
  user profile block aligned right — shows the signed-in user's name (derived from
  `displayName` or the email local-part) and email, with an initial-letter avatar;
- the page canvas background `bg-[#f4f6fa]` with `p-8 pt-6`.

Navigation is driven by the `navItems` array inside `MainLayout`. Active state uses
`<NavLink>` from react‑router (`isActive` → blue pill `bg-blue-600 text-white`). To add a page,
add one entry to `navItems` **and** register its route in `src/App.jsx` (`protectedRoutes`).

### Pages (all share the MainLayout nav)

| Label                | Route                | File                          | Status        |
| -------------------- | -------------------- | ----------------------------- | ------------- |
| Fleet Overview       | `/dashboard`         | `(operator)/Dashboard.jsx`    | built (mock data) |
| Manage Conductors    | `/manage-conductors` | `(operator)/ManageConductors.jsx` | built (mock data) |
| Manage Bus           | `/manage-bus`        | `(operator)/ManageBus.jsx`    | placeholder   |
| Manage Route         | `/manage-route`      | `(operator)/ManageRoute.jsx`  | placeholder   |
| Passenger Feedback   | `/feedback`          | `(operator)/PassengerFeedback.jsx` | placeholder |
| Lost Item Reports    | `/lost-items`        | `(operator)/LostItemReports.jsx` | placeholder |
| End of Trip Reports  | `/end-reports`       | `(operator)/EndOfTripReports.jsx` | placeholder |
| Account Settings     | `/settings`          | `(operator)/AccountSettings.jsx` | built (user info + sign out) |
| Operator Login       | `/login`             | `(operator)/OperatorLogin.jsx`| built — Firebase wired; **not** wrapped in MainLayout |

That is 9 screens total: 8 inside the shell + the standalone login. `/` redirects to
`/dashboard`; unknown paths also redirect to `/dashboard`.

Placeholder pages render `<PagePlaceholder>` inside `<MainLayout>` — replace the body with real
content, keep the `<MainLayout>` wrapper.

## Design system (match the mockups exactly)

The visual style is fixed by the provided screenshots. New pages must match it — same palette,
radii, spacing, typography. Copy patterns from `Dashboard.jsx` and `ManageConductors.jsx`.

- **Canvas background:** `bg-[#f4f6fa]`; **sidebar:** `bg-[#edf1f7]`; **cards:** `bg-white`.
- **Primary / accent:** `blue-600` (hover `blue-700`, active `blue-800`), often with
  `shadow-lg shadow-blue-600/30` on buttons and `shadow-blue-500/20` on active nav.
- **Text:** headings `text-slate-950` / `text-slate-900`, body `text-slate-600`/`700`,
  muted/labels `text-slate-400`/`500`. Uppercase micro‑labels: `text-[11px] font-semibold uppercase tracking-wider`.
- **Status colors:** active/positive = `emerald` (`bg-emerald-50 text-emerald-700`, dot
  `bg-emerald-500`); inactive/neutral = `slate` (`bg-slate-100 text-slate-700`).
- **Cards:** `rounded-2xl` / `rounded-3xl`, `shadow-sm`, `border border-slate-100`
  (or `border-slate-200/60`), padding `p-5`/`p-6`.
- **Buttons:** `rounded-xl`, `text-xs font-semibold`, `px-5 py-2.5`; icon + label with `gap-2`;
  add `cursor-pointer`.
- **Icon chips:** small rounded square, e.g. `w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center`.
- **Fonts:** `font-sans` (system stack); weights run heavy — `font-bold` / `font-extrabold` /
  `font-black` for numbers and titles.
- **Tables:** header row `text-[11px] uppercase tracking-wider text-slate-500`, rows
  `border-b border-slate-100 hover:bg-slate-50`, avatars `w-10 h-10 rounded-full ring-1 ring-slate-100`.
- Avatars in mockups use `randomuser.me` placeholder URLs — fine as placeholders, replace with
  real data when wiring Firebase.

## Authentication (how it works)

Accounts are provisioned by the team in **Firebase Authentication** (email/password provider).
There is no registration or password-reset flow — "Forgot Password?" is a no-op link.

- `src/lib/firebase.js` calls `initializeApp` / `getAuth` once from the `VITE_PUBLIC_FIREBASE_*`
  env vars.
- `src/context/AuthContext.jsx` — `<AuthProvider>` wraps the app in `App.jsx` and subscribes to
  `onAuthStateChanged`. `useAuth()` returns `{ user, loading, signIn, signOut }`.
  - `signIn(email, password, rememberMe)` sets persistence
    (`browserLocalPersistence` if "Remember Me" is checked, else `browserSessionPersistence`)
    then calls `signInWithEmailAndPassword`.
- `src/components/ProtectedRoute.jsx` — shows a splash while `loading`, redirects to `/login`
  (preserving the intended path in `location.state.from`) when there is no `user`, else renders
  the page. Every route in `App.jsx`'s `protectedRoutes` is wrapped in it.
- `OperatorLogin.jsx` — on submit calls `signIn(...)`, navigates to the intended path (or
  `/dashboard`) on success, and shows a single inline error on failure that does **not**
  disclose whether the email exists. If already signed in it `<Navigate>`s away from `/login`.
- Sign out: the sidebar "Sign Out" button and `AccountSettings` both call `signOut()` then
  navigate to `/login`.

## Environment

`.env` (Vite exposes only `VITE_`‑prefixed vars to the client):

```
VITE_PUBLIC_GOOGLE_MAPS_API_KEY=...
VITE_PUBLIC_FIREBASE_API_KEY=...
VITE_PUBLIC_FIREBASE_AUTH_DOMAIN=...
VITE_PUBLIC_FIREBASE_PROJECT_ID=...
VITE_PUBLIC_FIREBASE_DATABASE_URL=...
VITE_PUBLIC_FIREBASE_STORAGE_BUCKET=...
VITE_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
VITE_PUBLIC_FIREBASE_APP_ID=...
VITE_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

Read them as `import.meta.env.VITE_PUBLIC_FIREBASE_API_KEY`, etc.

`.env` is now gitignored (`.env.example` is the committed template). It was previously committed
with real keys — those live in git history, so **rotate the Google Maps key** and restrict it by
HTTP referrer in the Google Cloud console. Firebase web config values are not secrets, but
lock down access with Firebase Auth + security rules. To purge the tracked copy locally:
`git rm --cached .env` (already done in the working tree — commit it).

## Current state / known gaps

- Auth is fully wired (login, protected routes, persistence, sign out). Needs a real account in
  the Firebase project's Authentication tab to test end to end.
- `Dashboard.jsx` and `ManageConductors.jsx` render **mock/hard‑coded data** — no Firebase
  reads yet (Realtime DB / Firestore not integrated).
- `ManageBus/ManageRoute/PassengerFeedback/LostItemReports/EndOfTripReports` are placeholders.
- The notification bell in `MainLayout` is decorative (static red dot).
- `src/App.css` and `src/assets/*` are Vite starter leftovers and can be removed.
- Build emits a "chunk > 500 kB" warning — Firebase is large; code-split later if it matters.

## Conventions

- Functional components, default export, one component per file, `PascalCase.jsx`.
- Authenticated pages live in `src/(operator)/` and are wrapped in `<MainLayout>`.
- Shared/reusable UI goes in `src/components/`.
- Style exclusively with Tailwind utility classes inline — no CSS modules, no styled‑components.
  Match the design‑system section above; when unsure, mirror an existing page.
- Icons from `lucide-react` only.
- Keep the sidebar/header out of individual pages — extend `MainLayout` instead.
- No `import React` — use React 19's automatic JSX runtime; import hooks by name.
- `npm run lint` must pass (ESLint errors on unused vars, incl. an unused `React` import).
