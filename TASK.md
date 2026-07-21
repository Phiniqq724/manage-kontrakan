# Task: Sup-Member (Supreme Member) Role Feature (Kontrakan/Naungi)

Add a new elevated role — **sup-member** — on top of the existing two-role system (member, admin).

## Context / Assumptions (confirm against codebase before building)

- Currently the app has 2 roles: `member` and `admin`.
- A specific `member` account gets converted/upgraded to `sup-member`. This is not a general feature offered to all members — it's a single, specific account (the owner/manager of the app who happens to also be a regular member).
- Sup-member unlocks:
  1. **Add other account** (hard limit: 1 additional account).
  2. **Switch session** between their own account and the added account, without needing to fully log out/log in each time.
  3. Sup-member (and likely the linked/added account too — confirm) is **excluded from monthly bill/iuran calculations**, since this role is for the person managing the app and they're the one who pay the bill

If any of the above interpretations don't match intent, flag it back before implementing rather than guessing further.

## Before Writing Any Code

1. Inspect current auth setup — Supabase Auth session handling, how `member`/`admin` roles are currently stored and checked (custom claims, a `role` column, RLS policies, etc.).
2. Inspect the existing monthly bill / iuran logic (from the receipt/billing feature) to see exactly where users get included in bill calculations, so the exclusion can hook into the same place cleanly.
3. Check how sessions are currently persisted (AsyncStorage / SecureStore / Supabase session storage) since multi-account session switching needs careful handling here.

## Feature Requirements

### 1. Role: sup-member

- Extend the role system/schema to support `sup-member` in addition to `member` and `admin`.
- Only a manually-designated account can hold this role (this is not self-serve — likely set directly in the database or via an admin-only action, confirm which).

### 2. Add other account (limit 1)

- Sup-member gets a UI action to link one additional account to their own.
- **Linking requires authenticating as the target account** — i.e. the sup-member must enter/confirm the target account's login credentials during the linking flow (this is a verification step, not just picking a user from a list).
- Enforce the limit of 1 linked account per sup-member at the data layer, not just in the UI.

### 3. Session switching

- Once linked, the sup-member can switch their active session between their own account and the linked account.
- Design this so switching is fast (no full re-auth needed after the initial link) — likely storing both sessions/tokens locally and swapping the active one, or using Supabase's session management to hold both and switch the active client session.
- Be deliberate about security here: think through what happens on token expiry/refresh for the inactive session, and make sure switching can't leak one account's data into the other's view.

### 4. Billing exclusion

- Sup-member should not appear in monthly bill/iuran generation or totals.
- Confirm whether the linked/added account should also be excluded, or only the sup-member account itself. (Only sup-member)
- Implement this exclusion at the query level where monthly bills are generated (not just hidden in the UI).

## Native UI Note

If any new screens or buttons or anything related to UI are needed for this feature (e.g. "Manage linked account" screen, session switcher), follow the same rule as other native screens in this app: use `@expo/ui/jetpack-compose` components only, wrapped in `<Host>`, with component APIs confirmed against the `.d.ts` files before use — same convention as the rest of the app.
(note from dev: Don't create new page, just use the existing profile, add Add account button there. Then the user need to fill up login form in bottom sheets. After that the button will be changed to "Switch account to {name}". Then the user can easily switch back to back. Well this also confirm that the admil will have this ui too. If the user log out one of the account, for example they log out the admin account. It'll change session to other active session. If there is no active session, then it'll log out as usual)

## Deliverable

- Schema/role changes to support `sup-member`.
- Add-account flow with target-account login verification, capped at 1.
- Session switcher UI + underlying session management logic.
- Billing logic updated to exclude sup-member (and linked account if applicable) from monthly totals.

- Schema/role changes to support `sup-member`.
- Add-account flow with target-account login verification, capped at 1.
- Session switcher UI + underlying session management logic.
- Billing logic updated to exclude sup-member (and linked account if applicable) from monthly totals.
