# Feature Spec: Event & Request (Dashboard Quick Action Replacements)

> **Before implementing any UI change described below, check the existing codebase first.**
> Find the current dashboard/quick action components, the existing vote/rules feature (referenced below as the pattern to mirror for Request), and existing notification logic (Expo Push API via Supabase Edge Functions). Match existing naming conventions, folder structure, component patterns, and data-fetching patterns (Supabase queries/hooks) already used elsewhere in the app. Do not introduce a new library or dependency — both features below should be achievable with Supabase (tables, RLS, maybe an Edge Function) plus straightforward app-side logic.
>
> **Design system constraint:** All UI must use `@expo/ui/jetpack-compose` (Android-only target). Do not fall back to `StyleSheet`, custom View-based components, or any other UI library for these features.

---

## 1. Event — Optional Kontrakan Events with Attendance Voting

### Purpose

Let any member create an event (e.g. a gathering, communal activity) that other members can optionally opt into. Attendance is a simple yes/no vote per member, not mandatory.

### Requirements

**Creating an event**

- A member can create an event with:
  - Event name
  - Time/date
  - Location
  - (Implicit) creator/owner reference
- Event participation is optional — members are not required to respond.

**Voting / responding to an event**

- Each member can vote whether they're attending (e.g. "Ikut" / "Tidak ikut", or similar to how the existing rules-vote UI is structured — check that pattern first).
- The event detail should show who has voted to attend (and optionally who declined, if that's tracked).

**Reminders / notifications**

- On the day of the event, ideally send an automatic notification to members who voted "attending" reminding them the event is happening.
  - Check whether this can be done via a scheduled Supabase Edge Function (e.g. using `pg_cron` to trigger a function daily that queries for events happening "today" and sends push notifications through the existing Expo Push API integration).
  - If a scheduled/cron-based approach isn't feasible with the current Supabase setup, fall back to a simpler mechanism: a manual "Remind everyone going" button on the event detail screen (visible to the creator, or anyone) that immediately triggers a push notification to all members who voted attending — reusing the existing Expo Push API / Edge Function notification pipeline.
- Either way, do not introduce a new notification service or library — reuse the existing push notification pipeline already built for the app.

**Navigation**

- Add a new quick action button on the dashboard for Event, **replacing the existing "Tamu" (guest) quick action button**. Confirm exactly which quick action component this is before removing it, and check if "Tamu" functionality needs to be preserved/moved elsewhere or is being fully retired — confirm with the user if unclear.

### Data Model Considerations

- New table, e.g.:

  ```
  events
  - id
  - creator_id
  - name
  - location
  - event_time (timestamptz)
  - created_at
  ```

  ```
  event_votes
  - id
  - event_id
  - user_id
  - is_attending (boolean)
  - created_at
  ```

- Check existing tables/conventions (e.g. how the rules/vote feature stores votes) before finalizing column names and types, to stay consistent.

### Edge Cases to Handle

- A member changing their vote after already voting (allow updating the existing vote row rather than creating duplicates).
- Events in the past should not still solicit new votes or trigger reminders.
- If the cron-based auto-reminder is implemented, make sure it doesn't double-send if the function runs more than once on the same day.

---

## 2. Request — Reddit-Style Member Requests with Upvote/Downvote

### Purpose

Give members a page to post free-form requests (e.g. "boleh pelihara kucing?") that other members can upvote or downvote. Similar interaction pattern to the existing rules-vote feature, but conceptually separate: Requests are informal member suggestions, not rules, and are entirely optional to engage with — they never get promoted into the rules list.

### Requirements

**Posting a request**

- Any member can create a request with at least: title/description, creator reference, timestamp.

**Voting on a request**

- Other members can upvote or downvote a request (one vote per member per request, changeable).
- Display the current vote tally (and optionally the current member's own vote state) on each request.
- Check the existing rules-vote implementation first — if the vote-casting logic/component can be reused or lightly adapted (same upvote/downvote mechanic, just pointed at a different table), do that instead of building parallel logic from scratch.

**Navigation**

- Add a new quick action button on the dashboard for Request, **replacing the existing "Vote" quick action button** (the one that currently points to rules voting). Confirm where the existing rules-voting entry point will live afterward — it likely needs to move somewhere else in the navigation (e.g. inside a settings/rules section) rather than disappearing. Confirm with the user if the destination for the old "Vote" flow isn't obvious from the codebase.

### Data Model Considerations

- New tables, e.g.:

  ```
  requests
  - id
  - creator_id
  - title
  - description
  - created_at
  ```

  ```
  request_votes
  - id
  - request_id
  - user_id
  - vote_value (1 for upvote, -1 for downvote)
  - created_at
  ```

- Reuse the existing rules-vote table structure/conventions as closely as possible if one already exists, rather than inventing a new voting schema from scratch.

### Edge Cases to Handle

- A member changing their vote from up to down (or vice versa) should update the existing vote row, not insert a second one.
- Sort order on the list page (likely by net vote score, check if the existing rules-vote list has a sorting convention to mirror).
- Decide whether a member can edit/delete their own request after posting, and whether votes reset if edited (confirm with the user if not obvious from how rules entries are edited).

---

## General Notes for Claude Code

- Both features are buildable with Supabase tables/RLS (+ possibly one Edge Function for Event reminders) and app-side logic — no new libraries or dependencies should be needed.
- Since both features replace existing dashboard quick action buttons ("Tamu" and "Vote"), confirm before removing anything whether the replaced functionality needs a new home in the navigation, rather than assuming it's fully retired.
- Implement and test Event and Request separately, even though they share a similar voting pattern — don't conflate them into one shared abstraction unless the existing rules-vote code already provides a clean reusable base.
- All new/changed screens and components must use `@expo/ui/jetpack-compose`, consistent with the rest of the app.
