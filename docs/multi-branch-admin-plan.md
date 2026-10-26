# Multi-Branch Admin Plan

## Delivery status

V1 is implemented: an owner can add branches, accounts with multiple active memberships choose one at `/select-shop`, and the admin shell can switch between memberships. Every selected shop is resolved from the signed-in account's active staff membership. Branches start with independent data. Cross-branch summaries, invitations, and shared data remain out of scope.

## Goal and scope

Allow one business owner to manage more than one of their own YELO Coffee shops from the existing web admin. Each branch remains a separate `shops` record with its own menu, staff, devices, LINE settings, members, sales, reports, and payment configuration. The owner signs in once, selects a branch, and uses the existing shop admin for that branch.

This plan is for a business owner managing their own branches. It does not create a YELO Coffee staff console that can browse every customer's shops.

### V1 user outcomes

- An owner can create a second branch with the same verified account.
- The owner can see the branches their account can access and select one.
- The active branch is visible in the admin shell and can be changed without signing out.
- All existing admin actions and pages continue to operate on exactly one selected branch.
- Existing one-branch accounts retain a direct path to the current admin experience.
- A branch can be set up independently; no data is implicitly shared across branches.

### Explicitly out of scope for V1

- A YELO Coffee platform-operator admin or global access to customer shops.
- Shared menus, shared member balances, pooled staff, or cross-branch inventory.
- Cross-branch sales reports or consolidated exports.
- User invitations and a single manager account spanning many shops. The data model should allow this later, but V1 focuses on one owner account managing its own branches.
- Permanent branch deletion. Existing shop-owned rows use cascading foreign keys, so deleting a shop can erase sales and loyalty history.
- Billing, subscription limits, or franchise hierarchies.

## Existing behavior and constraints

- Business data is tenant-scoped with `shop_id`; orders, products, staff, members, devices, and configuration belong to one shop. [`backend/src/db/schema.ts`](../backend/src/db/schema.ts)
- Admin accounts are rows in `users`. A shop admin identity is currently represented by `staff.auth_user_id`; that column has a global unique constraint, allowing one auth user to link to only one staff row/shop. See the `staff` declaration in the schema.
- [`ShopSetupService`](../backend/src/shop-setup.service.ts) checks whether a user has any staff row and refuses to create another shop once one exists.
- [`StaffSessionService`](../backend/src/staff-session.service.ts) returns the first active staff row for the account. It has no selected-shop input and does not resolve a list of memberships.
- [`requireStaff()`](../frontend/src/lib/auth.ts) derives one `shopId`; every admin page and server action is expected to use it. [`frontend/src/app/admin/layout.tsx`](../frontend/src/app/admin/layout.tsx) renders that shop's name and role.
- Shop roles (`owner`, `manager`, `barista`) live on `staff` and govern one shop. Do not replace them with a global role.
- Login/session cookies already authenticate `users`; the frontend calls the Nest API through a server-only internal API client. The browser must not choose an arbitrary `shopId` for data requests.

## Recommended domain model

### Reuse the per-shop staff row as the membership

For V1, keep `staff` as the per-shop admin/POS identity instead of adding a second membership table. It already carries the shop-specific role, display name, active state, and staff ID required by current admin actions and POS operations.

Change the uniqueness rule for `staff.auth_user_id`:

1. Drop the current global unique constraint on `auth_user_id`.
2. Add a unique constraint on `(shop_id, auth_user_id)` so the same account has at most one staff/membership row in each branch.
3. Keep `auth_user_id` nullable for POS-only staff who do not have an admin account.
4. Keep the existing foreign key to `users` and `ON DELETE SET NULL` behavior.
5. Continue to use each branch's staff role independently. The same user may be owner in one branch and manager in another if they are explicitly added to that branch.

The existing data needs no backfill: current accounts already have zero or one linked staff row. The migration must be applied before the product begins creating duplicate `auth_user_id` values across different shops.

### Branch ownership and creation

Create a branch by inserting a new `shops` row and an active `staff` row with `role = 'owner'`, `auth_user_id = currentUser.id`, and the owner's shop-facing name. Use the existing transaction pattern and preserve the slug uniqueness rule. The current random suffix can remain for V1.

Treat a branch as independent. New branches start with their own default/empty setup. If menu copying is later requested, provide an explicit copy step that duplicates categories, products, modifier groups, and product-group links transactionally; do not create live shared references between shops.

## Authentication and active branch resolution

### Membership list API

Replace the one-row staff-session lookup with two server-side operations:

- List all active memberships for an authenticated user: shop ID, name, slug, staff ID, role, and membership state.
- Resolve a selected shop for an authenticated user by matching both `auth_user_id` and `shop_id` and requiring `is_active = true`.

The internal API can retain its existing service-to-service guard. The Next server must derive `userId` from the validated session cookie and must never accept a user ID from a form or query string as proof of identity. The selected shop ID is an input to the resolver only; it is not authorization by itself.

Implemented API shapes:

```text
GET  /v1/auth-users/:authUserId/shops
GET  /v1/auth-users/:authUserId/shops/:shopId/staff-session
POST /v1/shops/setup
```

All responses must be runtime-validated by Zod schemas in the frontend API adapter. The membership list response must not include LINE secrets, payment credentials, customer PII, or other shop configuration.

### Active branch cookie

Use the `cafenme_active_shop` cookie containing only the selected shop UUID:

- `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/admin`, and bounded lifetime aligned with the auth session.
- Set it only in a server action after the backend resolver confirms membership.
- Clear it on logout and when it no longer resolves to an active membership.
- Revalidate it in `requireStaff()` on every request boundary. Never trust the cookie's UUID without resolving it against the current user's active staff row.

An unsigned UUID cookie is only a selector, not a capability. The backend membership lookup is the authorization check.

### Login and routing rules

- **0 active memberships:** send the user to first-shop onboarding.
- **1 active membership:** select it automatically and send the user to `/admin`.
- **2+ active memberships:** send the user to a branch picker before entering `/admin`.
- **Existing `cafenme_active_shop` still valid:** send the user directly to `/admin`.
- **Selected membership removed/deactivated:** clear the cookie and show the branch picker or an access-denied state; do not silently select a different branch.
- **Adding a branch while signed in:** create it, select the new branch, and enter its setup checklist.

## Admin experience

### Branch picker

Add an authenticated `/select-shop` experience outside the current shop-bound `/admin` layout, because that layout calls `requireStaff()` and requires a selected shop.

Each branch card shows:

- Shop/branch name.
- The current user's role in that branch.
- A clear branch selection action.

Add “Create a branch” only for users whose membership role is `owner`. Do not show inactive memberships as selectable. The picker should work on mobile and be keyboard accessible.

### Branch switcher

Add a compact switcher in the desktop sidebar and mobile header. It shows the active shop and opens the user's branch list. Selecting a branch posts to a server action that validates membership, sets the cookie, and redirects to `/admin`.

When a user changes branch, clear branch-scoped UI state and refresh server data. Do not carry product IDs, category IDs, report filters, or selected staff IDs into a different branch unless the state is explicitly namespaced by `shopId`.

### Branch creation flow

Add `/admin/branches/new` with fields for:

- Branch name.
- Owner display name for this branch.
- PromptPay ID, optional and validated as today.
- Owner POS PIN for this branch, with confirmation.

Reuse the existing setup validation where appropriate. Explain that data starts separately and that the owner can set up the menu, LINE, payment, and POS device after creation. Prevent duplicate submissions and handle a slug conflict by regenerating the slug server-side.

## Data isolation invariants

1. Every page query, form action, report, export, and mutation continues to use the `shopId` returned by `requireStaff()`.
2. Never accept the target `shopId` as the sole authorization input from browser data.
3. The only branch-switch operation is the server action that resolves current-user membership before updating the selector cookie.
4. `staffId`, role, and shop name are resolved together from the selected membership; do not reuse staff IDs across shops.
5. Switching branches must not reuse cached data from the previous branch. Keep shop-scoped fetches uncached or include `shopId` in cache keys and invalidation tags.
6. Role checks apply to the selected membership. An owner role in one branch does not grant owner permissions in another branch.
7. Creating a branch associates only the current authenticated owner and does not copy data from another shop without an explicit user action.

## Implementation sequence

### Phase 1 — Data and backend membership resolution

- Add a Drizzle migration dropping the global unique constraint and adding unique `(shop_id, auth_user_id)`.
- Update the Drizzle schema and generated migration metadata.
- Change `StaffSessionService` to return a list and to resolve one requested shop only when the user has an active linked staff row there.
- Update `ShopSetupService` so an existing owner can create additional shops; keep transaction and retry protections.
- Add integration tests using one user and two shops, plus unrelated user/shop pairs.

**Done when:** one user can have owner staff rows in two different shops; a duplicate membership in the same shop is rejected; unrelated users cannot resolve either shop; existing one-shop sessions still resolve.

### Phase 2 — Session selection and branch picker

- Add Zod schemas and server-only adapters for membership list and selected membership.
- Add `active_shop_id` cookie helpers with set, clear, and read operations.
- Update the sign-in and `requireStaff()` flow for 0, 1, and multiple memberships.
- Add `/select-shop` and a server action to validate and save the chosen branch.
- Update logout and revoked/deactivated membership behavior.

**Done when:** the browser cannot enter an unlinked shop by editing a cookie, URL, form field, or server-action argument; one-shop users retain existing behavior.

### Phase 3 — Branch switcher and branch creation

- Add the switcher to the existing admin shell on desktop and mobile.
- Add `/create-branch`, owner-only server authorization, and a transactional create operation.
- After creation, select the new branch and route to the existing setup checklist.
- Add explicit UI feedback for a lost membership, inactive branch, slug collision, or failed create request.

**Done when:** an owner creates and switches between two branches without logging out; the displayed shop, role, and admin data always match the selected branch.

### Phase 4 — Cross-branch overview (optional V1.1)

- Add a branch overview to the picker or a separate `/admin/branches` page.
- Show one row/card per accessible branch with setup state and a small set of aggregate indicators.
- Do not merge full sales reports in this phase.
- If showing “today,” compute it in each branch's `timezone`; label per-branch values clearly. Do not sum values from different local business days into one misleading total.

**Done when:** every aggregate is scoped to the user's memberships and its shop's timezone, and report detail still requires selecting a branch.

### Phase 5 — Staff access across branches (later)

- Let an owner invite an existing account or create a controlled invitation for a manager.
- Create one `staff` membership row per shop with its own role and active state.
- Provide owner controls to revoke only the selected shop membership.
- Add invitation expiry, one-use tokens, and audit records before exposing invites publicly.

## Candidate file map

| Responsibility | Likely files |
|---|---|
| Shop-specific login context | `frontend/src/lib/auth.ts`, `frontend/src/server/auth-actions.ts`, `frontend/src/server/staff-session.ts` |
| Cookie and branch selection | New server-only helper under `frontend/src/lib/` or `frontend/src/server/`; new `/select-shop` page and server action |
| Admin shell switcher | `frontend/src/app/admin/layout.tsx`, `frontend/src/app/admin/navigation.tsx` or a new branch-switcher component |
| Branch onboarding | `frontend/src/app/onboarding/` and a new `/create-branch` route/action |
| Backend membership lookup and creation | `backend/src/staff-session.service.ts`, `backend/src/staff-session.controller.ts`, `backend/src/shop-setup.service.ts`, `backend/src/shop-setup.controller.ts` |
| Database rule | `backend/src/db/schema.ts`, new `backend/drizzle/0018_multi_branch_memberships.sql`, Drizzle journal |
| API response contracts | `frontend/src/server/staff-session.ts`, `frontend/src/server/shop-setup.ts` |
| Regression coverage | `frontend/src/server/pos-session.int.test.ts` or new membership integration tests; auth and onboarding action unit tests |

File names are a proposed map; confirm exact route and test locations before implementation.

## Test plan

### Database and backend integration

- Same user is linked to two shops and receives two distinct staff IDs and potentially distinct roles.
- Same user cannot have two staff rows for the same shop.
- A user cannot resolve another user's shop by supplying its UUID.
- Deactivated staff rows are excluded from the membership list and session resolution.
- Adding a second shop is transaction-safe under duplicate/retried requests; no half-created shop remains.
- Existing staff rows, POS PIN login, staff management, and current one-shop admin sessions continue to work.

### Frontend unit and server-action tests

- Sign-in routing for zero, one, and multiple active memberships.
- Branch picker only lists backend-returned memberships.
- Tampered/unlinked shop selection is rejected and does not set the cookie.
- Invalid or expired selection cookie is cleared and cannot expose shop data.
- Non-owner membership cannot create a branch.
- Branch create validates inputs and selects only the newly created branch.
- Logout clears both authentication and selected-shop cookies.

### End-to-end acceptance

Seed owner A with branches North and South, and owner B with branch Other. Verify:

- A can open North and South, switch between them, and create a third branch.
- A cannot see or open Other, even by direct URL or modified form payload.
- Menu, reports, members, devices, settings, and exports change with the selected branch.
- Actions on North do not change South or Other.
- Owner/manager permissions remain branch-specific.
- POS staff login and POS device pairing remain attached to one branch.

## Rollout and rollback

1. Deploy the additive migration and backend membership resolver while no duplicate cross-shop user links have been created yet.
2. Deploy frontend selection and creation flows after the backend is ready.
3. Enable second-branch creation for owners after the production two-shop isolation checks pass.
4. Monitor membership resolution failures and unexpected branch-selection redirects.

The uniqueness migration has a safe pre-feature rollback: restore the old global unique index while no account has multiple shop rows. Once duplicate user IDs across shops exist, that rollback will fail; therefore rollback after launch must first reconcile memberships or roll forward with a compatible application fix. Do not delete shop rows as a rollback strategy.

## Decisions to make before implementation

1. Should owners be able to create branches immediately, or should V1 be limited to switching among branches provisioned by an operator?
2. Should a new branch start empty, or should the owner be offered an explicit “copy menu and add-ons from another branch” step?
3. Should the first release show a multi-branch sales overview, or only provide a branch picker and branch-specific admin?
4. Are multiple time zones needed, or may cross-branch “today” values assume `Asia/Bangkok` for now?
5. Should a shop owner be able to hold a manager role in another business owner's shop using the same account? The per-shop staff model permits it; product policy should determine whether to expose invitations.

## Acceptance summary

The feature is ready when one verified user can create/select multiple owned branches, each branch retains fully isolated data and roles, all existing admin actions remain scoped through the selected membership, and tests prove that altering the selected shop ID cannot cross tenant boundaries.
