# Ads+ User App — API contract

The dashboard authenticates with Firebase Google Sign-In and sends the Firebase ID token as `Authorization: Bearer <token>`. The older email-OTP and creator-coupon API are not part of this release.

## Configuration
Set `public/adsplus-config.json` `apiBaseUrl` to the HTTPS origin of the deployed **production Ads+ API** only after production smoke tests pass. Keep it blank in previews until an environment-specific config is provided. Never put secrets in this public JSON.

## Read endpoints
- `GET /v1/me/earnings`
- `GET /v1/me/earnings/history?limit=50&offset=0`
- `GET /v1/payouts?limit=50&offset=0`

All require a Firebase ID token. The earnings endpoint returns `wallet_balance_milli_paise`, `pending_rewards_milli_paise`, and `credited_rewards_milli_paise`. Milli-paise to paise conversion is integer division by 1000 for display; keep source values as strings.

History items use `kind`, `id`, `amount_milli_paise`, `status`, and `created_at`. The payout list returns status and a masked UPI ID; never show or persist the full destination from history.

## Payout request
`POST /v1/payouts`

Headers: Firebase `Authorization`, JSON `Content-Type`, and `Idempotency-Key` (8–128 characters). Body:
```json
{ "amount_paise": "2000", "upi_id": "name@upi" }
```
Minimum is ₹20. The API validates user state, UPI format, pending payout, wallet balance and atomically debits the wallet with an append-only spend ledger entry. Reuse the same key when retrying the same submission after network uncertainty. HTTP 200/201 means a request was recorded, not paid. Admin approval and manual UPI payout remain required; rejected requests must refund through an idempotent ledger entry.

## Safety
- Do not bundle the production API origin until its deployment and CORS are verified.
- Never invent wallet/reward/payout data in the browser.
- Payout status must come from the server; a request is not payment.
- Admin authorization is enforced by the API, not by hiding UI controls.
