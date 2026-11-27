# Ads+ User App

React + Vite account dashboard with Overview, Earnings, Wallet, Profile, Help and an admin surface. Authentication uses Firebase Google Sign-In and the Ads+ API.

## Live-data safety
- No fake wallet balances or reward records are generated.
- Wallet balance is converted from server milli-paise to display paise with integer arithmetic.
- Payout history is loaded from the server and submissions include an idempotency key.
- Creator referrals/coupons are intentionally outside the current release scope and are removed from navigation.
- `public/adsplus-config.json` stays blank until the production API origin is verified and deployed. Do not point the production user app at staging.

## Development
```sh
npm install
npm run build
npm run dev -- --host 0.0.0.0
```
See [API-CONTRACT.md](./API-CONTRACT.md) for the current endpoint contract.
