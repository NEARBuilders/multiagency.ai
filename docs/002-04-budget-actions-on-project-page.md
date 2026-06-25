# Budget actions on project detail page

### Context
This is a child ticket of #002-ux-improvements, to bring budget management inline on the project detail page. Currently the project detail page at `/admin/projects/{slug}` displays the project's budget breakdown via `<Budget>` components but does not allow allocating or deallocating funds there. Budget actions (allocate, deallocate, transfer) only exist in the Treasury → Budgets tab (`budgets-manager.tsx`). This forces a context switch between viewing a project and managing its budget.

### Overview
Add allocate and deallocate controls to the budget section of `/admin/projects/{slug}`. Follow the same token+amount pattern already used in `budgets-manager.tsx`:
- Token selection (dropdown of known tokens + custom option)
- Amount input (decimal → base unit conversion via `deriveBaseAmount()`)
- Note input (optional)
- "record budget" button (allocate)
- "record deallocation" button (deallocate)

Use the existing `TokenAmountFields` component from `ui/src/components/token-amount-fields.tsx`. Keep the cross-project transfer action in the central `/admin/budgets` page only — it involves two projects and doesn't fit the single-project context. After mutation, invalidate the project budget query, the budgets list, and the treasury balances queries.

The current budget display (`<Budget>` components) should remain — the new controls go below or beside it.

Files to change:
- `ui/src/routes/_layout/_authenticated/_admin/admin/projects.$slug.tsx` — add allocate/deallocate UI in the budget section
- `ui/src/components/token-amount-fields.tsx` — no changes needed (reuse as-is)
- `ui/src/lib/queries.ts` — no changes needed (existing query keys cover this)

### Acceptance Criteria
- [ ] Budget section on `/admin/projects/{slug}` shows allocate and deallocate controls
- [ ] Token selection works for known tokens and custom token input
- [ ] Amount input parses decimal input to base units correctly
- [ ] "record budget" creates a budget entry for the project
- [ ] "record deallocation" deallocates from the project's budget
- [ ] Budget display updates after mutation without page refresh
- [ ] Treasury balances queries are invalidated after mutation
- [ ] Cross-project transfers remain only in `/admin/budgets`
- [ ] Error states: insufficient budget triggers an error toast
- [ ] Loading states: button shows "recording..." while mutation is pending
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] Reuse the same `useMutation` patterns from `budgets-manager.tsx` — same API calls (`apiClient.budgets.adminCreate`, `apiClient.budgets.adminDeallocate`), same invalidation set.
- [ ] The existing `<Budget>` component in `ui/src/components/budget.tsx` shows the 5-column breakdown. The new controls should be visually subordinate — perhaps collapsible behind a "manage budget" button to avoid cluttering the detail page.
