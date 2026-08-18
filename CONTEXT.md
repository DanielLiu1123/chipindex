# Domain glossary

- **Group** — the boundary that owns a roster and its poker sessions.
- **Player** — a reusable person record. A player participates in a group through a `group_player` membership.
- **Session** — one poker game for a group. It is `OPEN` while chips can move and `SETTLED` after final chips are recorded.
- **Participant** — a player's membership in one session. `session_participant.settled_at` is the state boundary: `null` means active; a timestamp means cashed out or finalized.
- **Buy-in** — an immutable chip purchase in a session. Revoking one soft-deletes the row so history remains auditable.
- **Cash out** — freezes one participant's `final_chips` and `settled_at` while the session stays open. Undoing cash out clears both fields.
- **Settlement** — closes a session after every active participant has final chips. Chip conservation requires total final chips to equal total buy-ins unless the user explicitly forces an unbalanced record.

# Module boundaries

- `lib/group-mutations.ts` owns Group, Player, and roster writes.
- `lib/session-mutations.ts` owns Session creation, import, editing, and deletion.
- `lib/live-session-mutations.ts` owns live Participant and Buy-in transitions plus settlement.
- `lib/session-policy.ts` and `lib/live-session.ts` contain framework-independent domain rules.
- `lib/queries.ts` is the read-model boundary; API routes do not query tables directly.
