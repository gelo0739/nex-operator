# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project

**NEX Operator** — an internal web dashboard for transit operators / operations managers to
monitor a live bus fleet and manage conductors, buses, routes, passenger feedback, lost‑item
reports and end‑of‑trip reports for a Cavite (Philippines) bus network.

It is a **staff‑only tool**. Operator accounts are provisioned by the team directly in Firebase —
there is **no sign‑up, no password reset, no public access**. A user may only reach the dashboard
by signing in with an email/password that already exists in Firebase Authentication **and** whose
Firestore `users/{uid}` doc has `role: "operator"` and a bus `line`.

A sibling Expo app, **NEX** (`Desktop/NEX`), is the commuter/conductor mobile app on the same
Firebase project (`nex-71ab9`). Data written here (routes, conductor accounts) is read there.

## Tech stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------ |
| UI framework   | React 19 (`react`, `react-dom`)                              |
| Build tool     | Vite 8 (`npm run dev` / `build` / `preview`)                 |
| Styling        | Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config`; `src/index.css` is just `@import "tailwindcss";`) |
| Routing        | `react-router-dom` v7 (`<BrowserRouter>` — so no `useBlocker`)  |
| Icons          | `lucide-react` (used everywhere — do not introduce another icon set) |
| Maps           | `@react-google-maps/api` (`GoogleMap`, `PolylineF`, `OverlayViewF`) loaded via `useGoogleMaps()`; pins are Advanced Markers (`components/AdvancedMarker.jsx`) — never `MarkerF` |
| Drag & drop    | `@dnd-kit/core` + `@dnd-kit/sortable` (route stop reordering) |
| Auth / data    | `firebase` v12 — Auth; Firestore (`db`); Realtime DB (`database`) for live bus positions; Storage (`storage`); Functions (`functions`, region `asia-southeast1`) |
| Server         | Firebase Cloud Functions in `functions/` (Node 22, Admin SDK) — see below |
| Lint           | ESLint 10 flat config (`eslint.config.js`), `npm run lint` (Node globals for `functions/**`) |
| Language       | Plain JavaScript + JSX (no TypeScript)                       |

## Commands

```bash
npm install         # first-time setup
npm run dev         # Vite dev server (default http://localhost:5173)
npm run build       # production build to dist/
npm run preview     # serve the production build
npm run lint        # ESLint over **/*.{js,jsx}

cd functions && npm i                       # Cloud Functions deps
firebase deploy --only functions            # deploy callable functions
firebase deploy --only firestore:rules      # deploy firestore.rules
```

There is no test runner configured.

## Repository layout

```
firebase.json                  # firestore rules + functions config (project pinned in .firebaserc)
firestore.rules                # Firestore security rules (deployed)
functions/
  index.js                     # callable Cloud Functions: createConductor, resetConductorPassword, deleteConductor
  package.json                 # firebase-admin, firebase-functions (ESM, Node 22)
src/
  main.jsx                     # React entry — mounts <App/>, imports index.css
  App.jsx                      # BrowserRouter + <AuthProvider> + route table (protectedRoutes)
  index.css                    # Tailwind entrypoint (single @import line)
  lib/
    firebase.js                # initializeApp from VITE_PUBLIC_FIREBASE_* env; exports app, auth, db, database, storage, functions
  context/
    AuthContext.jsx            # <AuthProvider> + useAuth() — user, profile, busLine, loading, signIn, signOut
  hooks/                       # live-data hooks — subscribe in useEffect, return a value, unsubscribe on cleanup
    useBusCount.js             # Firestore `buses` collection size
    useActiveBusCount.js       # RTDB `activeBuses` with status "active" and lastUpdated < 5 min old
    useActiveBuses.js          # RTDB `activeBuses` (fresh + active) as Map<conductorId, {busId, routeId, routeName}>
    usePendingLostItemCount.js # Firestore `lost_item_reports` where status == "PENDING"
    useConductors.js           # Firestore `users` where role == "conductor" && line == busLine
    useConductorCount.js       # empty — unused (Manage Conductors counts from useConductors)
    useRoutes.js               # Firestore `routes` where line == busLine
    useGoogleMaps.js           # the ONE shared Maps loader (libraries: ["marker"]) + MAP_ID export
    useDrivingRoute.js         # debounced DirectionsService route for start → waypoints → end
  utils/                       # one-shot reads/writes and pure helpers
    dashboardServices.js       # getBuses, getRoutes, getConductorCount, subscribeToActiveBuses; *_COLLECTION names
    routeServices.js           # getRoute / createRoute / updateRoute / deleteRoute
    conductorServices.js       # callable wrappers (create / reset password / delete), updateConductor, generateTempPassword
    directions.js              # fetchDrivingRoute (DirectionsService) + reverseGeocode (Geocoder)
    geo.js                     # haversineMeters, bestInsertIndex, formatDuration/Distance, parseHours/formatHours
  (operator)/                  # route-group folder for authenticated operator pages
    OperatorLogin.jsx          # login screen (standalone, not wrapped in MainLayout)
    Dashboard.jsx              # "Fleet Overview" — live stat cards + map (mock bus pins)
    ManageConductors.jsx       # live conductor table, filters, pagination; add/edit/reset/delete
    ManageBus.jsx              # bus table + add/edit/delete pop-ups (mock data)
    ManageRoute.jsx            # live route cards; edit / return / delete
    ConfigureRoute.jsx         # route editor (new / edit / return) — not in the sidebar
    PassengerFeedback.jsx      # placeholder page
    LostItemReports.jsx        # placeholder page
    EndOfTripReports.jsx       # placeholder page
    AccountSettings.jsx        # shows signed-in user + sign out
  components/
    MainLayout.jsx             # shared sidebar + header shell for every operator page
    ProtectedRoute.jsx         # auth gate — splash while loading, redirect to /login if signed out
    PagePlaceholder.jsx        # "coming soon" empty-state body for unbuilt pages
    Modal.jsx                  # reusable pop-up shell (Escape / backdrop to close)
    ConfirmDialog.jsx          # reusable destructive-action confirm
    BusFormModal.jsx           # add/edit/delete bus form
    ConductorFormModal.jsx     # add / edit / reset password / delete conductor + one-time credentials panel
    RouteStopList.jsx          # sortable Start → waypoints → End list (dnd-kit)
    RouteEditorMap.jsx         # editable route map: draggable pins, polyline, time/distance callout, pick mode
    AdvancedMarker.jsx         # React wrapper for google.maps.marker.AdvancedMarkerElement
    MapPin.jsx                 # custom pin designs: start / waypoint / end / bus
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
    <MainLayout pageTitle="Manage Bus" pageSubtitle="View and manage your fleet inventory." headerAction={<button>…</button>}>
      {/* page body only */}
    </MainLayout>
  );
}
```

| Prop           | Purpose                                                       |
| -------------- | ------------------------------------------------------------ |
| `pageTitle`    | large bold heading rendered above the page body              |
| `pageSubtitle` | muted one‑line description under the title                   |
| `headerAction` | optional element shown right of the title (e.g. "Add New …" button) |
| `children`     | the page body; laid out in a vertical flex column with `gap-6`, scrollable |

`MainLayout` owns:
- the fixed **256px sidebar** (`w-64`, `bg-[#edf1f7]`) with the "NEX Dashboard" wordmark, the
  nav list, an "Account Settings" link (`/settings`) and a "Sign Out" button (`signOut()` →
  redirect to `/login`);
- the **64px top header** (`h-16`) with a notification bell (unread red dot) and the
  user profile block aligned right — shows the signed-in user's name (derived from
  `displayName` or the email local-part) and email, with an initial-letter avatar;
- the page canvas background `bg-[#f4f6fa]` with `p-8 pt-6`.

Navigation is driven by the `navItems` array inside `MainLayout`. Active state uses
`<NavLink>` from react‑router (`isActive` → blue pill `bg-blue-600 text-white`; child paths like
`/manage-route/new` keep their parent highlighted). To add a page, add one entry to `navItems`
**and** register its route in `src/App.jsx` (`protectedRoutes`).

### Pages

| Label                    | Route                            | File                              | Status |
| ------------------------ | -------------------------------- | --------------------------------- | ------ |
| Fleet Overview           | `/dashboard`                     | `(operator)/Dashboard.jsx`        | live stats; map pins are mock `BUS_LOCATIONS` |
| Manage Conductors        | `/manage-conductors`             | `(operator)/ManageConductors.jsx` | live — conductors on the operator's line, status/bus from RTDB; filters (name/route/status), pagination; add / edit / reset password / delete |
| Manage Bus               | `/manage-bus`                    | `(operator)/ManageBus.jsx`        | UI built, **mock data**; add/edit/delete pop-ups |
| Manage Route             | `/manage-route`                  | `(operator)/ManageRoute.jsx`      | live Firestore `routes` on the line; edit / return / delete |
| Configure Route (new)    | `/manage-route/new`              | `(operator)/ConfigureRoute.jsx`   | built — not in sidebar |
| Configure Route (return) | `/manage-route/new?returnOf=:id` | `(operator)/ConfigureRoute.jsx`   | built — source reversed, same stop names, saved as a new route |
| Configure Route (edit)   | `/manage-route/:routeId/edit`    | `(operator)/ConfigureRoute.jsx`   | built — loads the route from Firestore |
| Passenger Feedback       | `/feedback`                      | `(operator)/PassengerFeedback.jsx`| placeholder |
| Lost Item Reports        | `/lost-items`                    | `(operator)/LostItemReports.jsx`  | placeholder |
| End of Trip Reports      | `/end-reports`                   | `(operator)/EndOfTripReports.jsx` | placeholder |
| Account Settings         | `/settings`                      | `(operator)/AccountSettings.jsx`  | built (user info + sign out) |
| Operator Login           | `/login`                         | `(operator)/OperatorLogin.jsx`    | built; **not** wrapped in MainLayout |

`/` redirects to `/dashboard`; unknown paths also redirect to `/dashboard`.
Placeholder pages render `<PagePlaceholder>` inside `<MainLayout>` — replace the body with real
content, keep the `<MainLayout>` wrapper.

## Design system (match the mockups exactly)

The visual style is fixed by the provided screenshots. New pages must match it — same palette,
radii, spacing, typography. Copy patterns from existing pages (`ManageConductors.jsx`,
`ManageRoute.jsx`, `ConfigureRoute.jsx`).

- **Canvas background:** `bg-[#f4f6fa]`; **sidebar:** `bg-[#edf1f7]`; **cards:** `bg-white`.
- **Primary / accent:** `blue-600` (hover `blue-700`, active `blue-800`), often with
  `shadow-lg shadow-blue-600/30` on buttons and `shadow-blue-500/20` on active nav.
- **Text:** headings `text-slate-950` / `text-slate-900`, body `text-slate-600`/`700`,
  muted/labels `text-slate-400`/`500`. Uppercase micro‑labels: `text-[11px] font-semibold uppercase tracking-wider`.
- **Status colors:** active/positive = `emerald` (`bg-emerald-50 text-emerald-700`, dot
  `bg-emerald-500`); inactive/neutral = `slate` (`bg-slate-100 text-slate-700`). Manage Bus's
  INACTIVE badge is orange (`bg-orange-50 text-orange-600`) per its mockup.
  Warnings = `amber-50/800`, errors = `red-50/700`, info = `blue-50/800`.
- **Cards:** `rounded-2xl` / `rounded-3xl`, `shadow-sm`, `border border-slate-100`
  (or `border-slate-200/60`), padding `p-5`/`p-6`.
- **Buttons:** `rounded-xl`, `text-xs font-semibold`, `px-5 py-2.5`; icon + label with `gap-2`;
  add `cursor-pointer`.
- **Icon chips:** small rounded square, e.g. `w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center`.
- **Fonts:** `font-sans` (system stack); weights run heavy — `font-bold` / `font-extrabold` /
  `font-black` for numbers and titles.
- **Tables:** header row `text-[11px] uppercase tracking-wider text-slate-500`, rows
  `border-b border-slate-100 hover:bg-slate-50`. Profile pictures are **not** a feature — use a
  `UserRound` icon in a `w-10 h-10 rounded-full bg-slate-100` circle.
- **Pop-ups:** build on `Modal.jsx`; destructive confirms use `ConfirmDialog.jsx`. Don't stack two
  modals (both listen for Escape) — swap one for the other instead.

## Authentication & accounts

- `src/lib/firebase.js` calls `initializeApp` once from the `VITE_PUBLIC_FIREBASE_*` env vars.
- `src/context/AuthContext.jsx` — `<AuthProvider>` subscribes to `onAuthStateChanged` and, when
  signed in, to the live `users/{uid}` doc. `useAuth()` returns
  `{ user, profile, busLine, loading, signIn, signOut }`.
  - `busLine` = `profile.line` — the bus line this operator owns (e.g. `"Cavite-Batangas"`).
    Routes and conductors created by the operator get this `line`; pages only show data on it.
  - `loading` stays true until both auth and the first profile snapshot resolve.
  - `signIn(email, password, rememberMe)` sets persistence (`browserLocalPersistence` /
    `browserSessionPersistence`) then calls `signInWithEmailAndPassword`.
- `src/components/ProtectedRoute.jsx` — splash while `loading`, redirects to `/login` (keeping the
  intended path in `location.state.from`) when signed out.
- `OperatorLogin.jsx` — one inline error that does **not** disclose whether the email exists.
- **Conductor accounts** are created by operators from Manage Conductors via Cloud Functions
  (`username@nex.com`, random temporary password like `nex-7KQ4-M2PX`, shown once). The NEX app
  forces a password change at first login (`mustChangePassword: true` →
  `(auth)/ChangePassword`, which re-authenticates with the temporary password, calls
  `updatePassword`, then clears the flag).

## Data model

Firestore:
- `users/{uid}` — `email`, `role` (`"operator"` | `"conductor"` | `"commuter"`), `createdAt`.
  Operators and conductors also have `line`. Conductors: `name`, `mustChangePassword`,
  `createdBy`, `passwordResetAt` / `passwordChangedAt`. Commuters self-register in the NEX app.
- `routes/{id}` — `name` ("Start - End"), `startDestination`, `endDestination`,
  `StartingPoint`/`EndingPoint` `{lat,lng}`, `waypoints` `[{lat,lng,name}]`,
  `routeCoordinates` `[{latitude,longitude}]` (mobile polyline shape), `distanceMeters`,
  `durationSeconds`, `hours` (`"2:00 AM - 10:00 PM"` | `"24 Hours"`), `line`, `createdAt`/`updatedAt`.
- `buses/{id}` — `busNumber` (e.g. `"BUS-001"`), `plateNumber`, `model`. (Manage Bus mock data
  uses `busId` — switch to `busNumber` when wiring it to Firestore.)
- `lost_item_reports` (`status` e.g. `"PENDING"`), `service_feedbacks`, `trips` — written by the
  NEX app.

Realtime Database:
- `activeBuses/{busId}` — `busId` (bus number), `conductorId` (uid), `routeId`, `routeName`,
  `lat`, `lng`, `speed`, `status: "active"`, `lastUpdated` (ms). Written by the NEX conductor app
  (and bus-simulator). A bus counts as live only if `status == "active"` and `lastUpdated` is
  < 5 min old.

## Security rules (`firestore.rules`, deployed)

- `routes`: read = any signed-in user; create/update/delete = operators only.
- `users`: read = own doc or operator; self-create only as `role: "commuter"` without `line`;
  only operators may set/change `role` or `line`; delete = operator.
- Every other collection: any signed-in user can read/write (unchanged legacy behavior).
- Consequence: bus-simulator's route maker must sign in as an operator to save routes.

## Cloud Functions (`functions/`)

Operator-only account management that needs the Admin SDK lives in `functions/index.js`
(Node 22, region `asia-southeast1` — must match `getFunctions(app, "asia-southeast1")` in
`src/lib/firebase.js`). Project is on the Blaze plan. Client wrappers: `src/utils/conductorServices.js`.

- `createConductor({ name, username, password })` → Auth user `username@nex.com` + `users/{uid}`
  `{ email, name, role: "conductor", line, mustChangePassword: true, createdAt, createdBy }`
  (rolls the Auth user back if the Firestore write fails).
- `resetConductorPassword({ uid, password })` → new temporary password, revokes sessions, sets
  `mustChangePassword: true`.
- `deleteConductor({ uid })` → deletes the Auth user and `users/{uid}`.

Each checks the caller is an operator and the target conductor is on the operator's `line`.

## Maps

- Load the Maps JS API **only** through `useGoogleMaps()` — `@react-google-maps` throws if two
  loaders with the same id use different options. It loads the `marker` library.
- Every `GoogleMap` must set `options.mapId = MAP_ID` (from `useGoogleMaps.js`; env
  `VITE_PUBLIC_GOOGLE_MAPS_MAP_ID`, falls back to `DEMO_MAP_ID`, which is dev-only — create a
  real Map ID for production).
- Pins: `<AdvancedMarker position draggable onDragEnd anchor><MapPin variant … /></AdvancedMarker>`.
- The route editor uses `DirectionsService` (`stopover: false` waypoints, exact start/end pins
  spliced onto the polyline) and `Geocoder` — the Maps key needs **Directions API** and
  **Geocoding API** enabled.

## Environment

`.env` (Vite exposes only `VITE_`‑prefixed vars to the client):

```
VITE_PUBLIC_GOOGLE_MAPS_API_KEY=...
VITE_PUBLIC_GOOGLE_MAPS_MAP_ID=...      # optional; falls back to DEMO_MAP_ID
VITE_PUBLIC_FIREBASE_API_KEY=...
VITE_PUBLIC_FIREBASE_AUTH_DOMAIN=...
VITE_PUBLIC_FIREBASE_PROJECT_ID=...
VITE_PUBLIC_FIREBASE_DATABASE_URL=...
VITE_PUBLIC_FIREBASE_STORAGE_BUCKET=...
VITE_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
VITE_PUBLIC_FIREBASE_APP_ID=...
VITE_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

`.env` is gitignored (`.env.example` is the committed template). It was previously committed
with real keys — those live in git history, so **rotate the Google Maps key** and restrict it by
HTTP referrer in the Google Cloud console.

### Firebase MCP

`.mcp.json` registers the Firebase MCP server (`firebase mcp`) for Claude Code, and `.firebaserc`
pins the default project to `nex-71ab9`. Requires `npm i -g firebase-tools` and `firebase login`.
Use it to inspect data, security rules and project resources instead of guessing.

## Known gaps / next steps

- Manage Bus uses mock data — wire to Firestore `buses` (`busNumber`) with the operator's `line`.
- Fleet Overview map pins are mock — wire to `subscribeToActiveBuses`.
- Passenger Feedback, Lost Item Reports, End of Trip Reports are placeholders.
- `useConductorCount.js` is empty and unused.
- Cloud Functions artifact cleanup policy isn't set — run `firebase functions:artifacts:setpolicy`.
- The notification bell in `MainLayout` is decorative (static red dot).
- `src/App.css` and `src/assets/*` are Vite starter leftovers and can be removed.
- Build emits a "chunk > 500 kB" warning — Firebase is large; code-split later if it matters.

## Conventions

- Functional components, default export, one component per file, `PascalCase.jsx`.
- Authenticated pages live in `src/(operator)/` and are wrapped in `<MainLayout>`.
- Shared/reusable UI goes in `src/components/`.
- Live Firebase subscriptions go in `src/hooks/` (`useXxx.js`, default export, unsubscribe in
  the effect cleanup); one-shot reads/writes go in `src/utils/`. Always import Firebase handles
  from `src/lib/firebase.js` — never call `initializeApp` elsewhere.
- Operator-scoped data is filtered by `busLine` from `useAuth()`; anything an operator creates
  gets `line: busLine`.
- Anything needing the Admin SDK (other users' logins/passwords) goes in `functions/`, never
  the browser.
- Style exclusively with Tailwind utility classes inline — no CSS modules, no styled‑components.
- Icons from `lucide-react` only.
- No `import React` — use React 19's automatic JSX runtime; import hooks by name.
- `npm run lint` must pass (react-hooks v7 rules are strict: no setState synchronously in an
  effect, don't mutate state values — use refs for imperative objects like map markers).
