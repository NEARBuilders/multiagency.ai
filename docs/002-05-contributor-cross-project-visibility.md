# Contributor cross-project visibility on assignment

### Context
This is a child ticket of #002-ux-improvements, to surface a contributor's other project assignments when adding them to a project. Currently the assignment flow in `projects-admin-section.tsx:475` shows a dropdown of available contributors and a text input for role, with no context about what other projects the contributor is already on. This risks over-committing people without the operator realizing it.

### Overview
When a contributor is selected in the assignment dropdown, fetch and display their other project assignments below the dropdown. This requires:
1. A new or existing API endpoint that returns a contributor's project assignments. Check if `me.assignedProjects` can be reused or if a new `contributors.getAssignments({ contributorId })` endpoint is needed. Currently `assignments.adminList` returns assignments for a project, not for a contributor — the inverse query doesn't exist yet.
2. UI: after selecting a contributor from the dropdown, show a small card/badge list of their other projects (name, role, maybe status). This should appear inline below the assignment controls, not in a modal.

If an inverse query doesn't exist, add one: `contributors.getAssignments({ contributorId })` returning `{ data: { projectId, projectSlug, projectTitle, role }[] }`. This is a read-only endpoint, gated by `requireRole("admin", "contributor")`.

Files to change:
- `api/src/contract.ts` — add `contributors.getAssignments` endpoint if needed
- `api/src/index.ts` — implement handler for the new endpoint
- `ui/src/components/projects-admin-section.tsx` — add cross-project display in `AssignmentsSection`
- Or: `ui/src/routes/_layout/_authenticated/_admin/admin/projects.$slug.tsx` — if the assignment UI lives there post-#002-02

### Acceptance Criteria
- [ ] When selecting a contributor in the assignment dropdown, their other project assignments are displayed inline
- [ ] Each assignment shows: project name/slug, role, status
- [ ] Display is compact — badge list or small card, not a modal
- [ ] Changing the dropdown selection updates the display (no stale data)
- [ ] If the contributor has no other assignments, show "no other projects" or hide the section
- [ ] If a new API endpoint is added, it is gated by `requireRole("admin", "contributor")`
- [ ] Loading state: skeleton or spinner while fetching assignments
- [ ] Error state: graceful fallback if fetch fails (don't block assignment)
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] The inverse query can be built from `agency.project_contributors` joined with the projects plugin's data. Since projects live in the upstream plugin, we need to join across boundaries — either call the projects plugin per assignment or batch them.
- [ ] Alternative: add a `contributorId` filter to `assignments.adminList` so the existing endpoint can be reused with a different parameter.
