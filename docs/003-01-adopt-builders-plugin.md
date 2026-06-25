# Adopt builders plugin for contributors

### Context
This is a child ticket of #003-budgeting-reporting, blocked by #001-02 (projects plugin alignment + type generation), to replace the local `agency.contributors` table and CRUD with the builders plugin at `plugins/builders/`. The builders plugin (registered as `contributors` in `bos.config.json:36`) provides a richer contributor model:
- `nearAccount`, `userId`, `name`, `bio`, `skills[]`, `location`, `links{}`
- Endpoints: `listBuilders`, `getBuilder`, `getMyBuilderProfile`, `createBuilder`, `updateBuilderProfile`, `deleteBuilder`

The current `agency.contributors` table has `nearAccountId`, `name`, `email`, `onboardingStatus`. The builders plugin lacks `email` and `onboardingStatus`. Per user feedback, `onboardingStatus` moves to `agency.project_contributors` as a per-assignment field. `email` is dropped — the builders plugin doesn't track it. The `agency.billings.contributor_id` FK must update to reference builder IDs instead of contributor IDs. Existing contributor data must be migrated to the builders plugin.

### Overview
1. **Migrate data**: Write a migration script that reads all rows from `agency.contributors`, creates corresponding builder records via the builders plugin, and maps old IDs to new builder IDs.
2. **Move onboardingStatus**: Add `onboarding_status` column to `agency.project_contributors`. Migrate existing status values from `agency.contributors` to the join table rows. Drop `onboarding_status` from the contributors table.
3. **Update references**: Replace all `agency.contributors` queries in `api/src/index.ts` with builders plugin client calls. Replace contributor CRUD endpoints (`adminList`, `adminCreate`, `adminUpdate`) with builders plugin proxy calls. Update `agency.project_contributors` FK to reference builder IDs. Update `agency.billings.contributor_id` FK.
4. **Update UI**: Replace all contributor references in the UI (`useApiClient().contributors.*` → `useApiClient().contributors.*` maps to builders plugin via the proxy). Update query options in `ui/src/lib/queries.ts`. Update admin contributor list/forms.
5. **Drop table**: Remove `agency.contributors` table and its endpoints after migration.
6. **Regenerate types**: Run `bos types gen` to regenerate types including the builders plugin contract.

Files to change:
- `api/src/contract.ts` — remove contributor schemas, update or proxy through builders
- `api/src/index.ts` — replace contributor handlers with builders plugin proxy
- `api/src/db/schema.ts` — update `project_contributors` FK, add `onboarding_status`, remove `contributors` table
- `api/src/db/migrations/` — new migration for schema changes
- `api/src/db/migrations/` — data migration script (separate from schema migration)
- `ui/src/lib/queries.ts` — update contributor query options to use builders plugin
- `ui/src/components/contributors-admin-section.tsx` — update to use builders plugin types
- `ui/src/routes/_layout/_authenticated/_admin/admin.contributors.index.tsx` — update references

### Acceptance Criteria
- [ ] Builders plugin is called for all contributor operations (list, create, update, get)
- [ ] Existing `agency.contributors` rows are migrated to the builders plugin with no data loss
- [ ] `onboarding_status` column exists on `agency.project_contributors` with values migrated
- [ ] `agency.billings.contributor_id` references builder IDs
- [ ] `agency.project_contributors.contributor_id` references builder IDs
- [ ] `agency.contributors` table is dropped after migration
- [ ] Contributor create/edit forms in admin UI use builder fields (skills, bio, links, location)
- [ ] Contributor list in admin UI shows builder data (skills, location)
- [ ] All existing contributor functionality is preserved (assignment, billing linking, onboarding status display)
- [ ] `bos types gen` regenerates types including the contributors (builders) plugin
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] The builders plugin uses `nearAccount` as its natural key, while `agency.contributors` uses a generated `id`. The migration must handle this mapping — store a temporary lookup mapping old IDs to builder nearAccount values for updating FKs.
- [ ] `onboardingStatus` values: `"pending" | "complete" | "expired"`. Default to `"pending"` for new assignments.
- [ ] The UI's `contributors-admin-section.tsx` currently has inline create/edit forms with name/email/nearAccountId fields. These become name/nearAccount/skills/bio/location/link fields.
- [ ] The builders plugin's `createBuilder` is admin-gated (`requireAdmin`). The agency API's proxy must ensure the caller has the right context.
