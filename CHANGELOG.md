# Changelog

## 2026-07-12

### Added
- **Rule voting**: proposing a new rule now starts a vote among members instead of going
  straight to admin. Majority approve auto-creates the rule and notifies everyone; majority
  decline silently closes it; a tie is left for the admin panel to resolve manually. Vote
  tallies (setuju/tolak counts) stay visible on the Peraturan tab and in the admin panel even
  after you've voted.
- **Notification actions**: rule-vote push notifications now carry Setuju/Tolak buttons, so
  members can vote directly from the notification without opening the app.
- **Automatic piket reset**: a Postgres cron job checks weekly for an empty upcoming schedule
  and regenerates next month's piket rotation server-side — no longer depends on someone
  opening the app to trigger it.
- **In-app changelog**: a new Changelog screen (reachable from a button on the Home header)
  lists every update to the app. Admin can post new entries from the admin panel, which
  notifies every other member automatically.
- Guest registrations now notify every other member, not just the admin.

### Changed
- Piket schedule list now hides past entries — only ongoing/future piket days show.
- Padding-top on the Piket, Tamu, Penghuni, and Peraturan tabs now matches Home/Profile.
- Piket auto-reset frequency reduced from daily to weekly (the check is idempotent, so this
  only affects how quickly an emptied schedule gets refilled, not correctness).

### Fixed
- Rule proposal notifications previously only reached the admin; they now reach every member
  who's eligible to vote on it.
