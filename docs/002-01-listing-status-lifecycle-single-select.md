# Fix listing status flags to lifecycle single-select

### Context
This is a child ticket of #002-ux-improvements, to fix a bug where the internal listing form uses three independent checkboxes for `isPublished`, `isWinnersAnnounced`, and `isArchived`. These represent stages of a single lifecycle (published → winners announced → archived), not independent toggles. Independent checkboxes allow invalid combinations (e.g., archived + not published). They should be a single-select control — radio buttons or a dropdown — reflecting the lifecycle.

### Overview
Update the internal listing form in `ui/src/routes/_layout/_authenticated/_admin/admin/projects.$slug.tsx:783` to replace the three boolean checkboxes with a single-select control. Options: "draft" (none selected), "published", "winners announced", "archived". The Zod schema (`internalListingFormSchema`) must be updated from three `z.boolean()` fields to a single `z.enum()`. The form UI must update accordingly: a `<Field>` with radio buttons or a `<Select>` dropdown. The lifecycle drives rollup classification (see comment at line 1162), so must preserve the semantic mapping:
- published (no winners) → allocated
- winners announced → committed
- archived → excluded from rollups

The API contract (`api/src/contract.ts`) must also be updated if it uses the three boolean fields — check `agency.listings.adminCreate` / `adminUpdate` input schemas.

Files to change:
- `ui/src/routes/_layout/_authenticated/_admin/admin/projects.$slug.tsx` — form schema + UI
- `api/src/contract.ts` — if listing input schemas expose the three booleans
- `api/src/index.ts` — if handler logic maps the booleans
- `api/src/db/schema.ts` — if the columns should change (optional; can also map the enum to booleans at the DB layer)

### Acceptance Criteria
- [ ] Internal listing form has a single-select lifecycle control (radio or dropdown)
- [ ] Only one lifecycle stage is active at a time
- [ ] Invalid combinations (e.g., archived + not published) are impossible
- [ ] Existing listing data is handled correctly (migration or read-time mapping)
- [ ] Rollup classification still works correctly (allocated/committed/excluded)
- [ ] Create and update listing endpoints accept the new field shape
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] The DB columns can stay as three booleans — map the single-select value to the three columns on write/read. This avoids a migration but keeps the UI correct.
- [ ] If preferring a migration, the lifecycle field could be a single `status` text column with values `draft` / `published` / `winners_announced` / `archived`.
