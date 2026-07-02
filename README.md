# Naungi — Kontrakan Management App

> *Rumah bersama, tertib bersama.*

Naungi is an internal [Expo](https://expo.dev) (React Native) application for managing a shared rented house (*kontrakan*) of 5 members. It centralizes billing, chores (*piket*), guest logging, house rules, and member contacts so everything the household needs is transparent and in one place — instead of scattered across chat threads and spreadsheets.

## Features

**Member**
- Personal dashboard with this month's bill and payment status
- Log a guest visit (check-in / check-out) when inviting someone over
- View the piket (chore) schedule and request a swap/reassignment if unavailable
- Read house rules and propose new ones
- Report another member (e.g. rule violations)
- Look up every member's contact info

**Admin**
- Manage rooms (*kamar*) and assign members to them
- Manage member accounts
- Review and record payments, including proof-of-payment uploads
- Review member reports
- Approve/manage proposed rules
- Manage member passwords

**Platform**
- Email/password authentication via Supabase Auth
- Push notifications (Expo Notifications) — e.g. notifying the admin of new activity
- Role-based navigation (member vs. admin) via `expo-router`

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Expo](https://docs.expo.dev/versions/v56.0.0/) SDK 56 (React Native 0.85, React 19) |
| Routing | `expo-router` (file-based, typed routes) |
| Language | TypeScript |
| Styling | React Native `StyleSheet` |
| State | React Context API (no Redux) |
| Backend | [Supabase](https://supabase.com) (PostgreSQL, Auth, Storage) |
| Notifications | `expo-notifications` |

> **Note:** This project targets Expo SDK 56, which changed significantly from earlier SDKs. Always check the [versioned SDK 56 docs](https://docs.expo.dev/versions/v56.0.0/) rather than relying on general Expo knowledge.

## Project Structure

```
src/
├── app/            # expo-router routes (screens)
│   ├── (tabs)/      # member-facing tab navigation (dashboard, guests, piket, rules, profile, members)
│   ├── admin/       # admin-only screens (kamar, members, payments, reports, rules, passwords)
│   └── auth/        # login
├── components/     # Reusable UI elements
├── constants/      # Theme tokens (colors, spacing, font sizes, etc.)
├── services/       # Supabase-backed API layer (one module per table: kamar, users, pikets, payments, guests, rules, reports, ...)
└── utils/          # Supabase client, auth helpers/context, push notifications, piket scheduling logic
```

## Getting Started

### Prerequisites

- Node.js (LTS) and npm
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) (via `npx`, no global install required)
- A Supabase project (URL + anon key)
- Android Studio / Xcode if you plan to run a native build locally, or the [Expo Go](https://expo.dev/go) app for quick testing

### Installation

```bash
git clone <repository-url>
cd manage-kontrakan
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
EXPO_PUBLIC_SUPABASE_KEY=your-supabase-anon-key
```

### Running the App

```bash
npx expo start
```

From the Metro output you can open the app in:
- A [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- An Android emulator — `npm run android`
- An iOS simulator — `npm run ios`
- A web browser — `npm run web`
- [Expo Go](https://expo.dev/go), for quick sandboxed testing

## Available Scripts

| Command | Description |
|---|---|
| `npm run start` | Start the Metro dev server |
| `npm run android` | Build and run on an Android device/emulator |
| `npm run ios` | Build and run on an iOS device/simulator |
| `npm run web` | Run the web build |
| `npm run lint` | Lint the project (`expo lint`) |
| `npm run reset-project` | Move starter code aside and reset to a blank `app/` directory |

## Quality Checks

Before submitting any change, run:

```bash
npx expo-doctor   # validates dependencies, config, and native project sync
npx tsc --noEmit  # type-checks the project
```

## Database

The app uses Supabase/PostgreSQL with tables including `users`, `kamar` (rooms), `pikets` / `piket_requests` (chore schedule and swap requests), `payments`, `guests`, `rules` / `rule_requests`, and `reports`. Row types and API bindings are generated/maintained in `src/utils/supabase-types.ts` and `src/services/api.ts`.

## Contributing

This is an internal tool built for a single household. If you're a member contributing changes:

1. Create a feature branch off `main`.
2. Make your changes, following the conventions in `CLAUDE.md` / `AGENTS.md`.
3. Run the quality checks above.
4. Open a pull request describing the *why* and *what* of the change.

## License

MIT — see [LICENSE](./LICENSE).
