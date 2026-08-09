# Username logins, admin control, and per-role calendars

## What changes

### 1. Register and sign in with a username
- Sign-in form asks for **username + password** only. No email anywhere.
- First-time registration: pick your name from the studio roster, choose your own username and password, and you're signed in immediately.
- Usernames are unique and case-insensitive; friendly errors for "username already taken" and "wrong username or password".
- Because no email is stored, forgotten passwords are reset by an admin (see below).

### 2. Admin control over people
On the Admin Console:
- **Add a new name** to the roster (name + gender label). The person then registers themselves with their own username and password.
- **Remove / reorder** roster names that haven't registered yet.
- **Change a member's username** (with the same uniqueness check).
- **Reset a member's password** — admin types a new password, hands it to the member.
- Keep the existing role switch (admin / shooter) and active toggle.

### 3. Admin master calendar: add and remove jobs
- Admins can book a job for any available shooter on any date (already possible) and now also **edit or delete any job**, including jobs created by someone else.
- Each job row on the day panel gets edit and delete controls, with a confirm step on delete.

### 4. Shooter calendar: own jobs only
- Non-admin members see only their **own** jobs — other shooters' job details, client names, locations and notes are hidden.
- They still manage their own availability on/off as today.
- The per-shooter summary grid and the master day panel show other members' availability only (no job details) for non-admins; admins keep the full view.
- Calendar day colours (blue / gold / metallic red) stay for admins. Shooters see their own jobs and availability marks.

## Technical notes

- **Auth**: usernames map to a deterministic synthetic address (`<normalized-username>@unboss.local`) used only internally by auth. Email confirmation stays off. Email-based password reset is not possible by design.
- **Schema**: add `username` (unique, lower-cased) to `profiles`; keep `team_members` as the roster and allow admin insert/update/delete on it via `has_role` policies. Registration trigger stores the chosen username.
- **Job visibility**: replace the blanket "team can view jobs" read policy with: admins see all jobs, shooters see rows where `shooter_id = auth.uid()`. Job delete/update policies widen to admins. Availability stays team-visible so slotting works.
- **Privileged admin actions** (create-free roster edits are plain table writes; password reset and username change touch auth) run through `createServerFn` handlers that verify the caller's admin role with `has_role`, then use the service-role client loaded inside the handler.
- Update `src/routes/auth.tsx`, `src/routes/admin.tsx`, `src/routes/schedule.tsx`, plus a new `src/lib/admin.functions.ts`.
