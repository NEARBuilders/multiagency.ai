# Epic 002: UX/UI Improvements — Demo-Ready Admin Flow

### Context

Admin functions are currently scattered across operator tabs on public pages (`/team`, `/work`, `/treasury`). The project form is two separate forms with a hand-typed slug and no NEARN helper text. Budget actions exist only in the Treasury tab, not on the project detail page. Contributor assignment shows no cross-project context. Internal listing status flags are independent checkboxes instead of a lifecycle control. Documentation is minimal. Admin list UIs use basic HTML tables with no sorting, filtering, or column management. This epic creates a coherent admin navigation shell, consolidates admin routes, fixes UX paper cuts, and introduces TanStack Table for all admin data grids so the product is demo-ready and provides the table foundation for Epic 3 reporting.

### Tickets

| # | Ticket | Dependency |
|---|--------|------------|
| 002-01 | Fix listing status flags to lifecycle single-select | — |
| 002-02 | Dedicated admin shell and standalone routes | — |
| 002-03 | Simplify project create/edit form | — |
| 002-04 | Budget actions on project detail page | — |
| 002-05 | Contributor cross-project visibility on assignment | — |
| 002-06 | Documentation improvements | — |
| 002-07 | TanStack Table data grids | 002-02 |

### Acceptance Criteria

- [ ] Internal listing status is a single-select control (radio or dropdown), not three checkboxes
- [ ] Admin sidebar navigation exists with routes: Projects, Contributors, Budgets, Billings, Applications, Settings
- [ ] Admin sections are removed from operator tabs on public pages
- [ ] Project form is a single form (not two) with auto-generated slug and NEARN helper text
- [ ] Budget allocate/deallocate actions are available on `/admin/projects/{slug}`
- [ ] Contributor assignment dropdown shows cross-project assignments
- [ ] Documentation is clear and demo-ready
- [ ] All admin list UIs use `@tanstack/react-table` with sorting, filtering, pagination, and column visibility
- [ ] All existing functionality preserved
- [ ] `bun typecheck` and `bun lint` pass
