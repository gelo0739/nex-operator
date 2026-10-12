# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project

**NEX Operator** — an internal web dashboard for transit operators / operations managers to
monitor a live bus fleet and manage conductors, buses, routes, passenger feedback, lost‑item
reports and end‑of‑trip reports for a Cavite (Philippines) bus network.

It is a **staff‑only tool**. Operator accounts are provisioned by the team directly in Firebase —
there is **no sign‑up, no forgotten-password reset, no public access** (a signed-in operator can
change their own password in Account Settings). A user may only reach the dashboard
by signing in with an email/password that already exists in Firebase Authentication **and** whose
Firestore `users/{uid}` doc has `role: "operator"` and a bus `line`. Anyone else (commuters,
conductors) is signed straight back out with the generic "invalid credentials" error.

A sibling Expo app, **NEX** (`Desktop/NEX`), is the commuter/conductor mobile app on the same
Firebase project (`nex-71ab9`). Data written here (routes, buses, conductor accounts) is read there;
feedback, lost-item reports, trips and live bus positions are written there.
`Desktop/bus-simulator` fakes conductor trips for testing.

## Tech stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------ |
| UI framework   | React 19 (`react`, `react-dom`)                              |
| Build tool     | Vite 8 / Rolldown (`npm run dev` / `build` / `preview`)      |
| Styling        | Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config`; `src/index.css` is just `@import "tailwindcss";`) |
| Routing        | `react-router-dom` v7 (`<BrowserRouter>` — so no `useBlocker`); pages are `React.lazy` |
| Icons          | `lucide-react` (used everywhere — do not introduce another icon set) |
| Maps           | `@react-google-maps/api` (`GoogleMap`, `PolylineF`) loaded via `useGoogleMaps()`; pins are Advanced Markers (`components/AdvancedMarker.jsx`) — never `MarkerF`; map pop-ups use `FloatingOverlay` — never `OverlayViewF` |
| Drag & drop    | `@dnd-kit/core` + `@dnd-kit/sortable` (route stop reordering) |
| Auth / data    | `firebase` v12 — Auth + Firestore (`lib/firebase`), Realtime DB (`lib/realtime`), Storage (`lib/storage`), Functions (`lib/functions`, region `asia-southeast1`) |
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
firebase deploy --only functions            # deploy callable + scheduled functions
firebase deploy --only firestore:rules      # deploy firestore.rules
firebase deploy --only firestore:indexes    # deploy firestore.indexes.json
firebase deploy --only storage              # deploy storage.rules
firebase deploy --only database             # deploy database.rules.json (RTDB)
```

There is no test runner configured. Security-rule changes were verified with
`@firebase/rules-unit-testing` against the emulators
(`firebase emulators:exec --only firestore --project demo-nex-rules "node test.mjs"` — on Windows
chain several scripts with `&`, not `;`). Test before deploying rules.

## Repository layout

```
firebase.json                  # firestore / storage / database rules, indexes, functions (project pinned in .firebaserc)
firestore.rules                # Firestore security rules (deployed)
firestore.indexes.json         # composite indexes (feedback, lost items, trips, photo retention)
storage.rules                  # Storage security rules (deployed)
database.rules.json            # Realtime Database rules (deployed)
functions/
  index.js                     # callables: createConductor, resetConductorPassword, deleteConductor, completePasswordChange
  photoRetention.js            # scheduled: purgeOldPhotos (daily), purgeOrphanPhotos (weekly)
  package.json                 # firebase-admin, firebase-functions (ESM, Node 22)
src/
  main.jsx                     # React entry — mounts <App/>, imports index.css
  App.jsx                      # BrowserRouter + <AuthProvider> + route table; pages are lazy-loaded
  index.css                    # Tailwind entrypoint (single @import line)
  lib/                         # Firebase handles — the only place initializeApp / getX(app) are called
    firebase.js                # initializeApp from VITE_PUBLIC_FIREBASE_* env; exports app, auth, db
    realtime.js                # database (RTDB)   — imported only by code that needs it,
    storage.js                 # storage           — so each SDK lands in the chunk of the
    functions.js               # functions         — pages that use it
    collections.js             # BUSES / ROUTES / USERS collection names (dependency-free)
  context/
    AuthContext.jsx            # <AuthProvider> + useAuth() — user, profile, busLine, isOperator, loading, signIn, signOut
  hooks/                       # live-data hooks — subscribe in useEffect, return a value, unsubscribe on cleanup
    useBuses.js                # Firestore `buses` on the line → { buses, loading, error }
    useLiveBuses.js            # RTDB `activeBuses`, fresh (< 5 min) + active, rechecked every 30 s — ALL lines
    useRoutes.js               # Firestore `routes` where line == busLine
    useConductors.js           # Firestore `users` where role == "conductor" && line == busLine
    useNewFeedback.js          # live `service_feedbacks` with status "new" on the line (bell)
    usePendingLostItemCount.js # live PENDING lost-item count on the line (Fleet Overview card)
    useLostItemChanges.js      # cheap "a report changed / arrived" signal (2 × limit-1 listeners)
    useCursorPagination.js     # numbered pages over a Firestore cursor query (feedback, lost items)
    useGoogleMaps.js           # the ONE shared Maps loader (libraries: ["marker"]) + MAP_ID export
    useDrivingRoute.js         # debounced DirectionsService route for start → waypoints → end
  utils/                       # one-shot reads/writes and pure helpers
    format.js                  # toMillis, formatDateTime / DateTime24 / Date / Time24 / DateLong, formatDuration,
                               #   formatTravelTime, formatDistance, isIndexBuildingError, loadErrorMessage
    routes.js                  # routeLabel(route, fallback), shortRouteName(name, separator)
    photos.js                  # resolvePhotoUrl(path, legacyUrl) — private Storage path or legacy URL
    activeBuses.js             # subscribeToActiveBuses (RTDB)
    busServices.js             # createBus / updateBus / deleteBus (line-scoped, unique busNumber)
    routeServices.js           # getRoute / createRoute / updateRoute / deleteRoute
    conductorServices.js       # callable wrappers (create / reset password / delete), updateConductor, generateTempPassword
    accountServices.js         # changeOwnPassword (re-authenticate + updatePassword), MIN_PASSWORD_LENGTH
    notificationServices.js    # clearNotifications (bell "Clear" → users/{uid}.notificationsClearedAt)
    directions.js              # fetchDrivingRoute (DirectionsService) + reverseGeocode (Geocoder)
    geo.js                     # haversineMeters, bestInsertIndex, parseHours/formatHours
    feedback.js                # FEEDBACK_TAGS/STATUSES, feedbackCategories, fetchFeedbackPage/Stats/Trend, getFeedback, updateFeedbackReview
    lostItems.js               # LOST_ITEM_STATUSES, fetchLostItemPage/Count, updateLostItemStatus, lostItemRef
    trips.js                   # fetchTripPage/Stats, fetchAllTrips + buildTripsCsv/downloadCsv, tripRef, initials, shortName
  (operator)/                  # route-group folder for authenticated operator pages
    OperatorLogin.jsx          # login screen (outside the app shell)
    Dashboard.jsx              # "Fleet Overview" — live stat cards + FleetMap
    ManageConductors.jsx       # live conductor table, filters, pagination; add/edit/reset/delete
    ManageBus.jsx              # live bus table (ACTIVE from RTDB); add/edit/delete
    ManageRoute.jsx            # live route cards; edit / delete (blocked while a bus is on the route)
    ConfigureRoute.jsx         # route editor (new / edit / return) — not in the sidebar
    PassengerFeedback.jsx      # feedback stats (aggregation queries), filters, cursor pagination, details
    LostItemReports.jsx        # lost-item status cards, route/status filters, cursor pagination, details
    EndOfTripReports.jsx       # trip stats, filters, infinite scroll, CSV export, trip report + map
    AccountSettings.jsx        # name / email / bus line / role, change own password, sign out
  components/
    AppShell.jsx               # sidebar + header (NotificationBell) + <Outlet/> — the layout route
    MainLayout.jsx             # per-page title block (pageTitle / pageSubtitle / headerAction) + body
    ProtectedRoute.jsx         # auth gate — splash while loading, /login if signed out, "No operator access" if not an operator
    NotificationBell.jsx       # header bell: live "new feedback" count + preview popover + Clear
    Modal.jsx                  # reusable pop-up shell (Escape / backdrop to close)
    ConfirmDialog.jsx          # reusable destructive-action confirm
    StatusPill.jsx             # pill with a dot, tones blue / amber / emerald / slate
    FeedbackStatusBadge.jsx    # New / Reviewed / Resolved (StatusPill)
    LostItemStatusBadge.jsx    # Pending / Item Found / Returned / Closed (StatusPill)
    FilterField.jsx            # labelled filter control + FILTER_CONTROL_CLASS
    Pagination.jsx             # table footer: summary + page buttons (pairs with useCursorPagination)
    DetailSection.jsx          # micro-labelled block in details pop-ups
    PhotoTile.jsx              # loads + shows a private/legacy report photo (retention-aware)
    StarRating.jsx             # 5 stars with partial fill (averages)
    CategoryPill.jsx           # feedback tag pill (green = compliment, amber = complaint)
    FeedbackDetailsModal.jsx   # full feedback review incl. ticket photo, submitter email, review status + note
    LostItemDetailsModal.jsx   # full report: item, contact (tel link), photos, resolution status + note
    TripReportModal.jsx        # full trip report + TripMap
    BusFormModal.jsx           # add/edit/delete bus form
    ConductorFormModal.jsx     # add / edit / reset password / delete conductor + one-time credentials panel
    FleetMap.jsx               # live fleet map: focus/follow a bus, covered/ahead route, pop-up
    TripMap.jsx                # completed trip start/end over its planned route
    RouteEditorMap.jsx         # editable route map: draggable pins, polyline, time/distance callout, pick mode
    RouteStopList.jsx          # sortable Start → waypoints → End list (dnd-kit)
    AdvancedMarker.jsx         # React wrapper for google.maps.marker.AdvancedMarkerElement
    MapPin.jsx                 # custom pin designs: start / waypoint / end / bus
    FloatingOverlay.jsx        # one moving OverlayView per map (pop-ups that never remount)
    LiveElapsed.jsx            # self-ticking "time since" text (keeps 1 s re-renders local)
  assets/images/               # app icons / login background — currently unreferenced
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

## The app shell — `AppShell.jsx` + `MainLayout.jsx`

`App.jsx` renders every authenticated page inside **one layout route**:

```jsx
<Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
  {protectedRoutes.map(({ path, element }) => <Route key={path} path={path} element={element} />)}
</Route>
```

`AppShell` (sidebar, header, `NotificationBell`, scroll container) therefore mounts **once** and
stays mounted across navigation — the bell's Firestore listener is not re-created per page. Pages
render into its `<Outlet/>` inside a `<Suspense>` spinner (pages are `React.lazy`). It also scrolls
the content back to the top on route change.

**Every authenticated page wraps its body in `<MainLayout>`**, which now only renders the page
title block above the children:

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
| `children`     | the page body (AppShell lays it out in a flex column with `gap-6`) |

`AppShell` owns:
- the fixed **256px sidebar** (`w-64`, `bg-[#edf1f7]`) with the "NEX Dashboard" wordmark, the
  nav list, an "Account Settings" link (`/settings`) and a "Sign Out" button;
- the **64px top header** (`h-16`) with the `NotificationBell` and the user profile block
  (name from `displayName` or the email local-part, email, initial-letter avatar);
- the page canvas `bg-[#f4f6fa]` with `p-8 pt-6`.

Navigation is driven by the `navItems` array inside `AppShell`. Active state uses `<NavLink>`
(`isActive` → blue pill `bg-blue-600 text-white`; child paths like `/manage-route/new` keep their
parent highlighted). To add a page, add one entry to `navItems` **and** register a lazy route in
`src/App.jsx` (`protectedRoutes`).

### Pages

| Label                    | Route                            | File                              | Status |
| ------------------------ | -------------------------------- | --------------------------------- | ------ |
| Fleet Overview           | `/dashboard`                     | `(operator)/Dashboard.jsx`        | live — Active / Inactive (line buses − live) / conductors / pending lost items; `FleetMap` of the line's live buses (click to focus + follow, route covered vs ahead, pop-up with speed, conductor, time on trip, route) |
| Manage Conductors        | `/manage-conductors`             | `(operator)/ManageConductors.jsx` | live — conductors on the line, status/bus from RTDB; filters, pagination; add / edit / reset password / delete |
| Manage Bus               | `/manage-bus`                    | `(operator)/ManageBus.jsx`        | live — `buses` on the line, ACTIVE when live in RTDB; add / edit (plate, model) / delete (blocked while live) |
| Manage Route             | `/manage-route`                  | `(operator)/ManageRoute.jsx`      | live — `routes` on the line; edit / delete (blocked while a live bus is on it) |
| Configure Route (new)    | `/manage-route/new`              | `(operator)/ConfigureRoute.jsx`   | built — not in sidebar |
| Configure Route (return) | `/manage-route/new?returnOf=:id` | `(operator)/ConfigureRoute.jsx`   | reached only from the editor's "Save & Create Return Route" — source reversed, same stop names, saved as a new route |
| Configure Route (edit)   | `/manage-route/:routeId/edit`    | `(operator)/ConfigureRoute.jsx`   | built — loads the route from Firestore |
| Passenger Feedback       | `/feedback`                      | `(operator)/PassengerFeedback.jsx`| live — avg rating / total / 30-day trend (aggregation queries), status / route / category / date filters, cursor pagination, View Details with review (status + note); deep links `?status=new`, `?open=<id>` |
| Lost Item Reports        | `/lost-items`                    | `(operator)/LostItemReports.jsx`  | live — Pending / Item Found / Returned / Closed cards (`count()`, follow the route filter, click to filter by status, kept live by `useLostItemChanges`), route / status filters, 5 per page, View Details with resolution (status + note) |
| End of Trip Reports      | `/end-reports`                   | `(operator)/EndOfTripReports.jsx` | live — total trips + average duration (aggregations), route / bus / conductor / date filters, infinite scroll, CSV export, full report with TripMap |
| Account Settings         | `/settings`                      | `(operator)/AccountSettings.jsx`  | built — name, email, bus line, role; change password (current + new + confirm, ≥ 8 chars; re-authenticates first, other sessions signed out); sign out |
| Operator Login           | `/login`                         | `(operator)/OperatorLogin.jsx`    | built; outside the app shell |

`/` redirects to `/dashboard`; unknown paths also redirect to `/dashboard`.

## Design system (match the mockups exactly)

The visual style is fixed by the provided screenshots. New pages must match it — same palette,
radii, spacing, typography. Copy patterns from existing pages (`ManageConductors.jsx`,
`ManageRoute.jsx`, `ConfigureRoute.jsx`), and reuse the shared pieces before writing new ones:
`StatusPill`, `FilterField` + `FILTER_CONTROL_CLASS`, `Pagination` + `useCursorPagination`,
`DetailSection`, `PhotoTile`, `Modal`, `ConfirmDialog`.

- **Canvas background:** `bg-[#f4f6fa]`; **sidebar:** `bg-[#edf1f7]`; **cards:** `bg-white`.
- **Primary / accent:** `blue-600` (hover `blue-700`, active `blue-800`), often with
  `shadow-lg shadow-blue-600/30` on buttons and `shadow-blue-500/20` on active nav.
- **Text:** headings `text-slate-950` / `text-slate-900`, body `text-slate-600`/`700`,
  muted/labels `text-slate-400`/`500`. Uppercase micro‑labels: `text-[11px] font-semibold uppercase tracking-wider`.
- **Status colors:** active/positive = `emerald` (`bg-emerald-50 text-emerald-700`, dot
  `bg-emerald-500`); inactive/neutral = `slate` (`bg-slate-100 text-slate-700`). Manage Bus's
  INACTIVE badge is orange (`bg-orange-50 text-orange-600`) per its mockup; Manage Bus and Manage
  Conductors keep their own badge shapes (per their mockups) instead of `StatusPill`.
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
- **Formatting:** dates, durations, distances, route names and load-error text come from
  `utils/format.js` and `utils/routes.js` — don't add local copies to pages.

## Authentication & accounts

- `src/lib/firebase.js` calls `initializeApp` once from the `VITE_PUBLIC_FIREBASE_*` env vars.
- `src/context/AuthContext.jsx` — `<AuthProvider>` subscribes to `onAuthStateChanged` and, when
  signed in, to the live `users/{uid}` doc. `useAuth()` returns
  `{ user, profile, busLine, isOperator, loading, signIn, signOut }`.
  - `busLine` = `profile.line` — the bus line this operator owns (e.g. `"Cavite-Batangas"`).
    Everything the operator creates gets this `line`; pages only show data on it.
  - `isOperator` = `profile.role === "operator"` with a `line`.
  - `loading` stays true until both auth and the first profile snapshot resolve.
  - `signIn(email, password, rememberMe)` sets persistence, signs in, then reads `users/{uid}`; a
    non-operator is signed out again and gets `auth/not-operator`, shown as the same generic
    error as a wrong password.
- `src/components/ProtectedRoute.jsx` — splash while `loading`, redirects to `/login` (keeping the
  intended path in `location.state.from`) when signed out, and shows a "No operator access" screen
  with Sign out when signed in without operator rights.
- `OperatorLogin.jsx` — one inline error that does **not** disclose whether the email exists.
- **Conductor accounts** are created by operators from Manage Conductors via Cloud Functions
  (`username@nex.com`, random temporary password like `nex-7KQ4-M2PX`, shown once, custom claim
  `role: "conductor"`). The NEX app forces a password change at first login
  (`mustChangePassword: true` → `(auth)/ChangePassword`: re-authenticate with the temporary
  password, `updatePassword`, then the `completePasswordChange` callable clears the flag — clients
  can't clear it themselves).

## Data model

Firestore:
- `users/{uid}` — `email`, `role` (`"operator"` | `"conductor"` | `"commuter"`), `createdAt`.
  Operators and conductors also have `line`; operators may have `notificationsClearedAt` (bell
  dismissal). Conductors: `name`, `mustChangePassword`, `createdBy`, `passwordResetAt` /
  `passwordChangedAt`. Commuters self-register in the NEX app.
- `routes/{id}` — `name` ("Start - End"), `startDestination`, `endDestination`,
  `StartingPoint`/`EndingPoint` `{lat,lng}`, `waypoints` `[{lat,lng,name}]`,
  `routeCoordinates` `[{latitude,longitude}]` (mobile polyline shape), `distanceMeters`,
  `durationSeconds`, `hours` (`"2:00 AM - 10:00 PM"` | `"24 Hours"`), `line`, `createdAt`/`updatedAt`.
- `buses/{id}` — `busNumber` (e.g. `"BUS-001"`, unique across all lines — RTDB is keyed by it),
  `plateNumber`, `model`, `line`, `createdAt`/`updatedAt`. `busNumber` and `line` can't change.
- `trips/{id}` — written by the NEX conductor app when a trip ends: `tripId`, `busId` (bus
  number), `busDocId` (verified against `buses`), `conductorId`, `routeId`, `route` (name), `line`,
  `startTime` / `endTime` / `arrivalTime` (Timestamps), `createdAt`, `status`,
  `durationSeconds` (int), `durationFormatted`, `totalDistanceKm`, `averageSpeedKmh`,
  `startLatitude/Longitude`, `endLatitude/Longitude`. Shown as `T-XXXXXX` (`tripRef()`).
- `service_feedbacks/{id}` — written by the NEX commuter app: `rating` (int 1–5), `comment`
  (≤ 2000), `categories` (array of tags: Smooth Drive, Clean Bus, On Time, Polite Staff, Reckless
  Driving, Delayed Arrival, AC Issue, Overcrowded), `category` (legacy combined string — read
  via `feedbackCategories()`), `routeId`, `routeName`, `line`, `userId`, `createdAt`, and either
  `ticketPhotoPath` (private Storage path, new) or `ticketPhotoUrl` (legacy public URL),
  `hasPhotos`. Review: `status` (`new` | `reviewed` | `resolved`), `operatorNote`,
  `statusUpdatedAt`, `statusUpdatedBy`, `statusUpdatedByEmail`. No bus number is collected.
- `feedback_rate_limits/{uid}_{routeId}` — `{ uid, routeId, lastAt }`, written in the same batch as
  each feedback; rules allow one feedback per user per route every 10 minutes.
- `lost_item_reports/{id}` — written by the NEX app: `userId`, `line`, `category`, `routeId`,
  `routeName`, `seatLocation`, `description`, `contactName`, `contactPhone`, `photoPath` /
  `ticketPhotoPath` (private, new) or `photoUrl` / `ticketPhotoUrl` (legacy), `hasPhotos`,
  `status` (`PENDING` on create → `FOUND` → `RETURNED` | `CLOSED`), `createdAt`. Resolution:
  `operatorNote`, `statusUpdatedAt/By/ByEmail`, and `resolvedAt` — set when RETURNED/CLOSED,
  `null` otherwise; photo retention keys off it. Shown as `ID: #LX-XXXXXX` (`lostItemRef()`).
  Pre-lockdown reports have no `userId`.

**Queries always filter `line == busLine`** (the rules require it). Indexes live in
`firestore.indexes.json`. **`average()` / `sum()` aggregations need a composite index that ends in
the aggregated field** (`…, rating:ASC`, `…, durationSeconds:ASC`) for *every* filter
combination — `count()` doesn't. Adding a filter to the feedback or trips page means adding its
aggregation index variants too (missing → `failed-precondition`; the error message contains the
exact index to create; `loadErrorMessage` shows "indexes are still building").

Realtime Database:
- `activeBuses/{busNumber}` — `busId` (bus number), `conductorId` (uid), `routeId`, `routeName`,
  `lat`, `lng`, `speed` (km/h), `status: "active"`, `lastUpdated` (ms), `tripStartedAt` (ms).
  Written by the NEX conductor app (and bus-simulator). A bus counts as live only if
  `status == "active"` and `lastUpdated` is < 5 min old (`useLiveBuses`). There is no `line` field
  — pages scope live buses to the line by `routeId` ∈ line routes or `conductorId` ∈ line conductors.

## Security rules

### Firestore (`firestore.rules`, deployed)

Helpers: `isOperator()`, `callerProfile()`, `operatorOnLine(line)` (operator **and** the doc's
`line` equals the operator's). Every operator permission is line-scoped. **There is no catch-all**
— a collection without a `match` block is denied, so add rules when adding a collection.

- `routes`: read = any signed-in user; create/update/delete = operator on the line; `line` can't change.
- `buses`: read = any signed-in user; write = operator on the line; `busNumber` / `line` locked.
- `users`: read = own doc, or an operator reading a commuter or a user on their line; create =
  self-registration as `commuter` only (no `line` / `mustChangePassword`); update = an operator may
  rename a conductor on their line (`name` only), and a user may edit their own doc except `role`,
  `line`, `mustChangePassword`, `passwordChangedAt`, `passwordResetAt`, `createdBy`; delete = never
  (the `deleteConductor` function does it).
- `service_feedbacks`: create = own `userId`, `status == "new"`, validated fields,
  `createdAt == request.time`, and the matching `feedback_rate_limits` doc in the same batch
  (`getAfter`); read = author or operator on the line; update = operator on the line, review fields
  only; delete = operator on the line.
- `feedback_rate_limits`: read own; create/update own with `lastAt == request.time`, update only
  if the previous `lastAt` is at least 10 min old; no delete.
- `lost_item_reports`: create = own `userId`, `status == "PENDING"`, length-checked fields; read =
  reporter or operator on the line; update = operator on the line, resolution fields only
  (`resolvedAt` a timestamp for RETURNED/CLOSED, null otherwise); delete = operator on the line.
- `trips`: create = a conductor, own `conductorId`, own `line`, `busDocId` exists with the same
  `busNumber`, Timestamp times, `createdAt == request.time`, known keys only; read = own conductor
  or operator on the line; no update; delete = operator on the line.

### Realtime Database (`database.rules.json`, deployed)

`activeBuses`: read = signed in; write = a **conductor** (`auth.token.role == "conductor"` custom
claim) writing their own `conductorId`, or taking over an entry that's > 10 min stale; fields are
validated and unknown children rejected. Tokens issued before the claim was set lack it — the NEX
app and bus-simulator force-refresh the ID token at trip start and retry once on
`PERMISSION_DENIED`.

### Storage (`storage.rules`, deployed)

- `feedback/{uid}/{feedbackId}.jpg` — feedback ticket photos. Upload: owner only, image, < 5 MB.
  Read: owner or operator (cross-service `firestore.get` on the caller's role). Docs store the
  **path**; the dashboard resolves it with `resolvePhotoUrl` (`utils/photos.js`).
- `lost_items/{uid}/{reportId}/item.jpg | ticket.jpg` — lost-item photos, same model as feedback.
- `lost_items/*`, `tickets/*` (flat, legacy) — no new uploads; read = operator. Old docs keep
  working through their token URLs.
- Everything else denied.

### Photo retention (`functions/photoRetention.js`)

- `purgeOldPhotos` — daily 03:00 Asia/Manila. Deletes feedback photos 180 days after
  `createdAt`; lost-item photos 180 days after `resolvedAt` or 365 days after `createdAt`. Finds
  work via `hasPhotos == true` (indexed), deletes the files (paths, or paths parsed from legacy
  URLs), then clears the photo fields and sets `hasPhotos: false`, `photosPurgedAt`.
- `purgeOrphanPhotos` — Sundays 03:30. Deletes any file under `feedback/`, `lost_items/`,
  `tickets/` older than 366 days (uploads whose doc was never written).
- Scheduled functions set `region` explicitly — ES-module imports are evaluated before
  `setGlobalOptions()` in `index.js`.

## Cloud Functions (`functions/`)

Operator-only account management that needs the Admin SDK lives in `functions/index.js`
(Node 22, region `asia-southeast1` — must match `src/lib/functions.js` and the NEX app's
`getFunctions(app, "asia-southeast1")`). Project is on the Blaze plan. Client wrappers:
`src/utils/conductorServices.js`.

- `createConductor({ name, username, password })` → Auth user `username@nex.com` with custom claim
  `role: "conductor"` + `users/{uid}` `{ email, name, role: "conductor", line,
  mustChangePassword: true, createdAt, createdBy }` (rolls the Auth user back if the Firestore
  write fails).
- `resetConductorPassword({ uid, password })` → new temporary password, revokes sessions, sets
  `mustChangePassword: true`, `passwordResetAt`.
- `deleteConductor({ uid })` → deletes the Auth user and `users/{uid}`.
- `completePasswordChange()` — called by the NEX app (as the conductor) after `updatePassword`.
  Requires `mustChangePassword === true` and that the account's `tokensValidAfterTime` is newer
  than `passwordResetAt` (or `createdAt`) — i.e. the password really changed — then clears the
  flag and sets `passwordChangedAt`.

The operator callables check the caller is an operator and the target conductor is on the
operator's `line`.

## Maps

- Load the Maps JS API **only** through `useGoogleMaps()` — `@react-google-maps` throws if two
  loaders with the same id use different options. It loads the `marker` library.
- Every `GoogleMap` must set `options.mapId = MAP_ID` (from `useGoogleMaps.js`; env
  `VITE_PUBLIC_GOOGLE_MAPS_MAP_ID`, falls back to `DEMO_MAP_ID`, which is dev-only — create a
  real Map ID for production).
- Pins: `<AdvancedMarker position draggable onDragEnd anchor><MapPin variant … /></AdvancedMarker>`.
- Pop-ups that follow a moving point: `FloatingOverlay` (one overlay per map, moved — never
  remounted). Put per-second tickers in `LiveElapsed` so the map doesn't re-render every second.
- The route editor uses `DirectionsService` (`stopover: false` waypoints, exact start/end pins
  spliced onto the polyline) and `Geocoder` — the Maps key needs **Directions API** and
  **Geocoding API** enabled.

## Bundle

Pages are `React.lazy` chunks. `vite.config.js` puts the always-needed Firebase core (app / auth /
firestore) in its own `firebase` chunk (~550 kB, ~163 kB gzip — the warning limit is 600 kB).
RTDB, Storage and Functions SDKs are only imported via `lib/realtime`, `lib/storage`
(dynamically, through `utils/photos.js`) and `lib/functions`, so they load with the pages that need
them. Keep it that way: **don't import `lib/realtime` / `lib/storage` / `lib/functions` from
anything the shell always loads** (AuthContext, AppShell, NotificationBell, `utils/feedback.js`,
`lib/collections.js`).

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

- **Rotate the leaked Google Maps key**, restrict it by referrer, and create a real Map ID.
- **App Check is not set up** (deferred): needs `@react-native-firebase/app-check` (Play Integrity)
  in NEX via a `CustomProvider` bridge, reCAPTCHA Enterprise in this dashboard, a debug token for
  bus-simulator, then enforcement for Firestore / Storage / Functions / RTDB after monitoring.
- RTDB `activeBuses` streams every line's buses to every client — key it by line
  (`activeBuses/{line}/{busNumber}`) or add `line` + `.indexOn` when the fleet grows.
- Index count is high (feedback + trips average indexes). If volume grows, switch the averages to
  scheduled daily roll-ups.
- Not responsive below ~1024 px (fixed sidebar, wide tables).
- No audit trail for route / bus edits; no error boundary around pages.
- `src/assets/images/` is unreferenced.

## Conventions

- Functional components, default export, one component per file, `PascalCase.jsx`.
- Authenticated pages live in `src/(operator)/`, are lazy routes inside `AppShell`, and wrap their
  body in `<MainLayout>`.
- Shared/reusable UI goes in `src/components/`.
- Live Firebase subscriptions go in `src/hooks/` (`useXxx.js`, default export, unsubscribe in
  the effect cleanup); one-shot reads/writes go in `src/utils/`. Always import Firebase handles
  from `src/lib/*` — never call `initializeApp` / `getFirestore` etc. elsewhere.
- Async results that depend on inputs are stored keyed (`{ key, data }`) and `loading` is derived
  (`state.key !== currentKey`) — no synchronous setState in effects, and late responses can't
  overwrite newer ones.
- Operator-scoped data is filtered by `busLine` from `useAuth()`; anything an operator creates
  gets `line: busLine`.
- Anything needing the Admin SDK (other users' logins/passwords, custom claims) goes in
  `functions/`, never the browser.
- Style exclusively with Tailwind utility classes inline — no CSS modules, no styled‑components.
- Icons from `lucide-react` only.
- No `import React` — use React 19's automatic JSX runtime; import hooks by name.
- `npm run lint` must pass (react-hooks v7 rules are strict: no setState synchronously in an
  effect, don't mutate state values — use refs for imperative objects like map markers, no
  `Date.now()` during render).
