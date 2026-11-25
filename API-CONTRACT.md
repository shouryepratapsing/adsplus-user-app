# Ads+ User App backend contract (update patch)

This update makes the app request live data from an Ads+ backend. It does not create fake wallet amounts or calculate earnings in the browser. There is no backend URL bundled in this ZIP.

## Configure the API origin

Edit `public/adsplus-config.json` in the existing project and set `apiBaseUrl` to the HTTPS origin of your deployed Ads+ API, for example an origin you control. Do not put API secrets in this public file.

## Required endpoints

All endpoints below are relative to `apiBaseUrl`. Use HTTPS in production.

### `POST /api/v1/auth/email/start`
Request: `{ "email": "user@example.com" }`

The server should send a time-limited one-time code to that address, rate-limit attempts, and return a generic success response that does not reveal whether an account exists.

### `POST /api/v1/auth/email/verify`
Request: `{ "email": "user@example.com", "code": "123456" }`

Success response must include `{ "access_token": "..." }`. The token is sent in the `Authorization: Bearer ...` header on authenticated API requests.

### `GET /api/v1/me/dashboard` (authenticated)
The UI expects a JSON object in the following general shape; return only fields that are real in your database:

```json
{
  "user": { "id": "opaque-id", "display_name": "Account name", "email": "user@example.com" },
  "wallet": {
    "available_paise": 0,
    "pending_paise": 0,
    "total_earned_paise": 0
  },
  "metrics": { "verified_events_today": 0 },
  "services": {
    "extension_connected": false,
    "payout_enabled": false,
    "coupons_enabled": false,
    "creator_commissions_enabled": false,
    "reward_modes": {
      "sponsored_link": false,
      "video_card": false,
      "response_follow_up": false
    }
  },
  "recent_activity": [],
  "reward_ledger": [],
  "withdrawals": [],
  "coupon_attribution": null
}
```

All money fields ending in `_paise` are integers in Indian paise (₹1 = 100 paise). Do not populate fields with sample data. Activity / ledger items should contain `id`, `label` or `description`, `created_at`, `status`, and `amount_paise` where available. `wallet.estimated_paise` is optional.

### `POST /api/v1/coupons/redeem` (authenticated)
Request: `{ "code": "CREATORCODE" }`

The server must validate that the code is active and uniquely owned, save attribution immutably, and enforce your rules for the user's eligible bonus and creator's eligible commission. The client does not grant benefits.

### `POST /api/v1/withdrawals` (authenticated)
Request: `{ "amount_paise": 10000, "method": "upi", "destination": "user@upi" }`

The server must recheck balance, minimum/maximum limits, account state, fraud rules, pending requests, and payout-provider status; reserve the balance transactionally; and return a request ID/status. A successful HTTP response means a request was received, not that money has been paid. The UI enables the form only when `services.payout_enabled` is true.

## Required production protections

- CORS must allow only the real front-end origins you control.
- Keep payment, email, database and signing secrets on the server, never in this app or the public config file.
- Credit rewards only from server-verified advertiser/extension events; prevent duplicate event IDs and replay.
- Maintain an immutable ledger and audit log. Never accept a client-supplied balance or commission amount.
- Configure email delivery, token expiry/revocation, rate limits, admin controls and an actual payout provider before enabling real withdrawals.

Until these services exist and are configured, the app should show no account balance, keep withdrawals unavailable, and not claim that earnings are active.

## Current Ads+ API (Firebase ID token)

The account app reads `GET /v1/me/earnings` and `GET /v1/me/earnings/history` with a Firebase ID token. `wallet_balance_paise` is the spendable wallet balance in integer paise. Reward-ledger fields ending in `_milli_paise` retain milli-paise precision (₹1 = 100,000 milli-paise); the UI converts only for display.

Payout request: `POST /v1/payouts` with `{ "amount_paise": "2000", "upi_id": "name@upi" }` and an `Idempotency-Key` header. Minimum request is ₹20. The server locks the user and wallet, deducts the paise amount and writes a matching append-only spend transaction atomically. A requested payout reserves wallet funds; rejection refunds through a separate idempotent ledger transaction. A request is not proof of payment.
