# Application → builder conversion

### Context
This is a child ticket of #003-budgeting-reporting, blocked by #003-01 and #002-02, to close the gap between accepted applications and the contributor management workflow. Currently when an admin accepts an application (via the applications review pipeline), the applicant sits in `accepted` status with no path to becoming a builder. The admin must manually re-enter the applicant's name, email, and NEAR account to create a builder record. The product review calls this out: "Convert an accepted application into a contributor."

With the builders plugin adopted (#003-01) and the admin shell in place (#002-02), we can add a one-click conversion that pre-fills the builder create form from the application data and optionally links the new builder to a project.

### Overview
Add a "convert to builder" button on accepted application cards in the applications admin section. The button opens a conversion dialog or inline form pre-filled with:
- `name` ← `application.name`
- `nearAccount` ← `application.nearAccountId`
- Optional: `skills`, `bio`, `links` (empty, manual)
- Optional: project selector (assign to a project immediately)

On submit:
1. Calls `contributors.createBuilder(...)` via the builders plugin with the pre-filled data
2. If a project was selected, calls `assignments.adminCreate(...)` to assign the new builder
3. Updates the application status to maintain `accepted` (already accepted, now converted)
4. Optionally adds a `convertedToBuilder: true` flag on the application

The "convert to builder" button should only appear on applications with status `accepted`. If already converted, show "converted" badge instead.

API changes: none needed — the conversion is a client-side orchestration of existing endpoints (`contributors.createBuilder`, `assignments.adminCreate`). The applications pipeline already has `adminUpdate` for status management.

Files to change:
- `ui/src/components/applications-admin-section.tsx` — add conversion button, dialog/form, and converted state
- Potentially a new component `ui/src/components/application-to-builder-dialog.tsx` for the conversion form

### Acceptance Criteria
- [ ] "Convert to builder" button appears on accepted application cards
- [ ] Conversion form pre-fills name and NEAR account from application data
- [ ] Optional project selector to assign the new builder immediately
- [ ] On submit: builder record created via builders plugin, optional assignment created
- [ ] Converted application shows "converted" state (button hidden, badge shown)
- [ ] If conversion fails (network error, duplicate nearAccount), error toast with retry
- [ ] Loading state on submit button ("converting...")
- [ ] Application remains in `accepted` status after conversion
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] The conversion is client-side orchestration — no new API endpoint needed. Call `contributors.createBuilder` then `assignments.adminCreate` sequentially.
- [ ] Handle the case where a builder with the same `nearAccount` already exists — the builders plugin will return an error. Surface it gracefully.
- [ ] Follow existing dialog patterns: use `Dialog` from `ui/src/components/ui/dialog.tsx`, `Field` from `ui/src/components/admin-form.tsx`.
- [ ] The `convertedToBuilder` flag could be stored in `application.metadata` (JSON column) to avoid a schema change.
