# Simplify project create/edit form

### Context
This is a child ticket of #002-ux-improvements, to streamline the project creation and editing experience. Currently:
1. The project form is effectively two separate forms — basic details (title, slug, NEARN listing) in `projects-admin-section.tsx` and the internal listing form in `projects.$slug.tsx` (after creation). A new project requires filling out both separately.
2. The slug is hand-typed with no auto-generation from the title. A placeholder `"lowercase-with-hyphens"` is the only guidance.
3. The NEARN listing slug field has no helper text explaining what it is or where to find it on NEARN.

### Overview
Consolidate into a single project creation form. Auto-generate the slug from the title as the user types (lowercase, spaces → hyphens, strip special chars) with a manual override. Add helper text under the NEARN slug field: "Enter the slug from your NEARN listing URL: nearn.io/listings/<slug>". The form should have clear sections: "Project Details" (title, slug, kind, description, visibility, status, repository), "NEARN Integration" (NEARN listing slug), "Internal Listing" (title, type, token, reward, description, deadline, lifecycle status) — collapsible sections via accordion or a step-by-step flow.

The internal listing section is optional — not all projects need an internal listing. Add a checkbox or toggle "Create internal listing" that reveals the listing fields.

Files to change:
- `ui/src/components/projects-admin-section.tsx` — rewrite the create form as a single consolidated form
- `ui/src/routes/_layout/_authenticated/_admin/admin/projects.$slug.tsx` — if this also has its own edit form, unify the patterns
- `ui/src/components/admin-form.tsx` — may need new wrappers for the accordion/collapsible sections

### Acceptance Criteria
- [ ] Single project creation form (not two separate forms)
- [ ] Slug auto-generates from title as the user types (lowercase, spaces → hyphens)
- [ ] Slug can be manually overridden after auto-generation
- [ ] NEARN listing slug field has helper text explaining what to enter
- [ ] Internal listing fields are optional, hidden behind a "Create internal listing" toggle
- [ ] Form sections are clearly separated (using collapsible sections or steps)
- [ ] Edit form follows the same structure (consolidated, not separate)
- [ ] Existing NEARN sponsor bounties "create from bounty" flow still works (prefill from NEARN)
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] Slug auto-generation: `title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')`. Debounce so it doesn't overwrite manual edits.
- [ ] For the edit form, consider extracting a shared `<ProjectForm>` component that both create and edit use, avoiding the current `useEffect` re-sync pattern in the edit form.
- [ ] The internal listing section should match the type/token/reward fields from the current `projects.$slug.tsx` listing form — but without the checkboxes (see ticket #002-01).
