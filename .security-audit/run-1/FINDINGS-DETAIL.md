# Findings Detail

## MEDIUM — Public sign-up lets attackers claim an unverified email address (`auth-service-unverified-email-squatting`)

### Data flow

1. `frontend/src/server/auth-actions.ts:88-115` accepts public signup fields, calls `/signup`, stores the returned session cookie, and redirects to onboarding.
2. `backend/src/auth.service.ts:22-43` normalizes and inserts the submitted email into the unique `users.email` field, then creates a session. No ownership check occurs.
3. `frontend/src/server/auth-actions.ts:129-160` allows the authenticated user to create a shop using that session's user ID.
4. `backend/src/shop-setup.service.ts:35-55` creates the shop and owner staff row bound to the attacker's user ID.
5. A later legitimate signup with the same address reaches the duplicate email path and receives 409 (`backend/src/auth.service.ts:36-39`; `frontend/src/server/auth-actions.ts:102-105`).

### Reproduction

As an unauthenticated visitor, submit the public signup action with a business email that has not been registered and an attacker-chosen password. Complete shop onboarding. The rightful email holder's subsequent signup is rejected as a duplicate. No live request was performed during this audit.

### Attacker outcome and boundary

The attacker controls the newly created account and owner shop associated with the claimed email, can block registration under that address, and may present a storefront under the business identity. This does not expose or take over an account or shop that already exists. The product's recovery path requires operator assistance according to the release documentation.

### Baseline comparison

For a multi-tenant POS with self-service business signup, the expected identity boundary is proof of control over the claimed owner email before provisioning an owner account. The reviewed implementation creates the owner account before that proof.
