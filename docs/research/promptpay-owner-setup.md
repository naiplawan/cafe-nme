# Owner Setup for PromptPay QR

## Summary

The owner should configure the shop's own PromptPay receiving identifier after linking it to a bank account. The app must not silently provide a demo identifier or imply it has verified the account owner. The implementation now provides an owner-only payment settings page and clears the seeded demo identifier on new setups.

The app now lets an owner add, change, or remove the PromptPay ID in admin settings, stores it for that shop, and keeps PromptPay disabled until the owner saves it.

## Research question

What should Cafe'nMe require from a shop owner before it generates a PromptPay QR, and what does the current implementation already support?

Scope: current production code on 2026-10-17, `promptpay-qr` 0.5.0, and the Bank of Thailand Thai QR Code Payment Standard and PromptPay guidance.

## Findings

### Bank registration belongs to the account holder

The Bank of Thailand says a user joins PromptPay by linking an existing bank account to a citizen ID or mobile number through the bank's mobile/internet banking, ATM, or branch channels. A mobile number cannot be linked to more than one account. [Bank of Thailand: PromptPay](https://www.bot.or.th/en/financial-innovation/digital-finance/digital-payment/promptpay.html)

Therefore, Cafe'nMe should ask the owner to register or confirm the receiving alias with their bank first, then enter that existing alias in the shop settings. The app cannot establish that the owner controls the bank account from the identifier's digit pattern alone.

For acquiring/merchant QR services, bank onboarding can be a separate process. For example, SCB's merchant QR/EDC application asks for applicant and settlement-account details and says the PromptPay ID used for its QR service must be linked to a deposit account held with SCB. [SCB merchant QR/EDC application](https://www.scb.co.th/content/dam/scb/personal-banking/payment/merchant-acquisition/merchant-form-qr-and-edc.pdf)

### PromptPay QR payload supports an amount

The Bank of Thailand Thai QR standard reserves the PromptPay merchant identifier template for PromptPay IDs, including mobile numbers and national/tax IDs, and defines transaction amount as QR field 54. It also says the payer app should use the name looked up from the PromptPay system rather than a merchant name embedded in the QR. [Bank of Thailand: Thai QR Code Payment Standard](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/ThaiQRCode_Payment_Standard.pdf)

The upstream `promptpay-qr` 0.5.0 API accepts a phone number, citizen/tax ID, or e-wallet ID and an optional amount; its API documentation says some banking apps prefill the amount when one is provided. [promptpay-qr API](https://github.com/dtinth/promptpay-qr/blob/master/api.d.ts)

### Current Cafe'nMe behavior

- Onboarding has an optional numeric `PromptPay ID` field. It accepts a 10-digit Thai mobile number or any 13-digit number, and the API stores the value in `shops.promptpay_id`.
- The admin page now allows only the authenticated shop owner to add, replace, or clear the ID; the Next Server Action and Nest API both enforce owner access.
- The production demo seed now starts with `promptpay_id = NULL`, so PromptPay is disabled until an owner configures it.
- The POS loads the shop's PromptPay ID, generates a QR with the current cart total, and presents a manual “check the bank app, then tap received” instruction. It does not receive a bank settlement callback or verify that money arrived.
- Checkout records the sale after staff confirms receipt. That confirmation is a staff action, not bank-verified payment status.

Relevant code: `frontend/src/app/onboarding/onboarding-form.tsx`, `frontend/src/server/auth-actions.ts`, `backend/src/shop-setup.controller.ts`, `backend/scripts/seed.ts`, `frontend/src/app/pos/checkout-actions.ts`, and `frontend/src/app/pos/_components/payment-dialog.tsx`.

## Interpretation and recommendations

1. **Give the owner a persistent payment setting.** Implemented in `/admin/payment`; onboarding remains optional.
2. **Explain the prerequisite in plain language.** Tell owners to register their receiving mobile number or shop tax ID with their bank first. For merchant acquiring products, follow the bank's own merchant onboarding and settlement-account instructions.
3. **Prefer a shop receiving alias.** Recommend the PromptPay number/ID the owner intends to use for customer receipts. Avoid encouraging a personal citizen ID when a shop phone or merchant tax ID is available; a 13-digit ID may be personal data.
4. **Use an explicit “verify recipient” step.** After saving, let the owner open a small test QR and scan it in their banking app, then check the bank-resolved recipient name before cancelling. Do not claim Cafe'nMe independently verified ownership.
5. **Remove the fabricated production alias.** New seeds now set `promptpay_id` to `NULL`; PromptPay stays unavailable until an owner configures it.
6. **Keep payment state honest.** Until a bank/acquirer integration provides a settlement notification or status API, label the action as staff confirmation and instruct staff to confirm the credited amount in the bank app. Generating a QR or tapping “received” does not prove settlement.
7. **Validate and protect the saved value.** Keep format validation server-side, mask the saved identifier in admin screens, restrict edits to owner/authorized roles, and ensure it is never included in logs or analytics. If the app later needs verified settlement and automatic receipts, integrate with an acquiring bank/payment provider instead of treating a static PromptPay alias as a verified payment rail.

## Caveats and unknowns

- The Bank of Thailand sources describe the payment rails and QR standard; they do not certify Cafe'nMe or `promptpay-qr` as a payment service provider.
- The SCB form is an example of one bank's merchant-acquiring process and should not be generalized to every bank.
- QR generation can prefill an amount, but that alone does not confirm payment. The app has no bank/acquirer callback in the current implementation.
- The current 13-digit validation does not distinguish a personal citizen ID from a business tax ID. A future UX should label the choices clearly and avoid collecting personal identifiers unless the owner chooses that alias.

## References

- [Bank of Thailand — PromptPay overview and registration](https://www.bot.or.th/en/financial-innovation/digital-finance/digital-payment/promptpay.html)
- [Bank of Thailand — Thai QR Code Payment Standard (PDF)](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/ThaiQRCode_Payment_Standard.pdf)
- [SCB — Merchant QR/EDC application (PDF)](https://www.scb.co.th/content/dam/scb/personal-banking/payment/merchant-acquisition/merchant-form-qr-and-edc.pdf)
- [dtinth/promptpay-qr — API types and usage](https://github.com/dtinth/promptpay-qr/blob/master/api.d.ts)
