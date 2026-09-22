# Architecture

## Ownership

- `components/ui/` contains shadcn primitives. Business dialogs keep only application rules such as pending-operation protection; Radix owns focus, keyboard navigation and dismissal.
- `lib/leaderboard.ts` owns the complete leaderboard calculation: inclusive date filtering, active-player selection, low-activity filtering, ranking and rebased cumulative curves. Table sorting does not change series order/colors. Views own display preferences and provide them to `buildLeaderboard`.
- `lib/use-live-session.ts` owns the live-session workflow: one active panel, preserved settlement drafts, request exclusion, errors and post-success refresh. Views own presentation and expanded history rows. `use-player-action.ts` continues to own buy-in request IDs and uncertain-response retries; these are not replaced by a generic mutation hook.
- `lib/buy-in-mutations.ts` owns participant preparation for both batch and legacy writes. It checks frozen participants, inserts missing participants without overwriting concurrent joins, and restores only deleted rows. Batch replay checks remain before the open-session check so a committed request can be retried after settlement.
- `lib/client.ts` owns HTTP transport and typed business operations. `lib/http.ts` owns authentication and error mapping. These are intentional seams, not generic CRUD factories.

## Legacy write compatibility

The app calls batch endpoints. The older POST endpoints remain compatibility adapters because repository searches cannot establish whether external callers exist:

| Operation | Membership and write behavior |
| --- | --- |
| POST participant | Requires active group membership; may join without buying in; returns a participant. |
| POST buyin | Auto-joins missing participants after checking group membership; existing session participants may continue buying in after leaving the group; returns a buy-in. |
| POST participant/batch | Requires group membership, joins players and records the buy-ins with caller-supplied stable IDs. |
| POST buyin/batch | Requires existing session participants and records buy-ins with caller-supplied stable IDs. |

All paths reject cashed-out participants. A server-generated UUID in a legacy adapter would not provide retry idempotency, so the legacy single-write contract does not claim that guarantee. The participant DELETE endpoint is still used by the app.

## Tests

Use real React rendering with Testing Library for interactive views and `renderHook` for a hook's public behavior. Mock HTTP/navigation or query seams rather than React hooks or shadcn primitives. Pure domain calculations remain ordinary unit tests. Server-page pagination tests render the real tables and mock only data reads, navigation and the chart observation seam.

The removed source-loading harness and shadcn host-tag substitutions must not be reintroduced. `test-browser-setup.ts` adapts only browser platform methods missing in jsdom. Timezone tests use fresh Node processes with `TZ` and native TypeScript stripping; the existing jsdom dependency already requires Node 22.22.2 or a supported newer release.

## Multi-table write consistency assessment

Reviewed application code on 2026-09-22. This refactor does **not** make multi-request writes transactional.

- Starting/importing a session inserts its session row before separate participant and buy-in writes.
- Editing a settled session changes existing rows and inserts new events before soft-deleting removed rows. Validating the entire command first and preserving event IDs reduces some failure modes but does not roll back earlier successful writes.
- Removing a participant updates participant and buy-in rows in separate requests.
- Settlement updates active participants before updating the session status. A mid-operation failure can leave a partially applied command.
- A batch buy-in inserts buy-in rows in one request, but participant preparation happens separately. Stable IDs and replay/conflict checks support recovery; this is not a transaction across both tables.

The repository has no SQL migration history, declared database functions, RPC callers or direct transactional connection configuration. Only the application code and repository configuration were assessed; the deployed database schema was not inspected or changed.

A complete consistency change needs a separately deployable database migration and a transactional command implementation, with authorization equivalent to the existing server checks. Before switching callers, verify rollback on every intermediate failure, concurrent cash-out/settlement, stable-command replay after a lost response, and preservation of buy-in IDs/timestamps. Do not add compensating deletes that might erase a concurrently committed command, or describe `Promise.all`/a TypeScript helper as a transaction.
