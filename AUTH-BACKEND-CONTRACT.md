# Ads+ Login / Sign-up API contract

This update adds the email-code login and account-creation UI. The browser UI is not a backend: real account creation only becomes active when `public/adsplus-config.json` points to an Ads+ API you control and that API sends verification email.

## Configure the public API origin

Set `apiBaseUrl` in `public/adsplus-config.json` to the HTTPS origin of your deployed API. Do not put API secrets, email provider keys, database passwords, or signing keys in this public file.

## `POST /api/v1/auth/email/start`

Login request:

```json
{ "email": "user@example.com", "intent": "login" }
```

Sign-up request:

```json
{ "email": "user@example.com", "intent": "signup", "display_name": "Krishna" }
```

The server sends a short-lived one-time code to that email, rate-limits requests, and returns a generic response that does not reveal account existence. For `signup`, do not create a usable account until the code is verified.

## `POST /api/v1/auth/email/verify`

Login request:

```json
{ "email": "user@example.com", "code": "123456", "intent": "login" }
```

Sign-up request:

```json
{ "email": "user@example.com", "code": "123456", "intent": "signup", "display_name": "Krishna" }
```

On success return a JSON object containing `access_token` (or `accessToken` / `token`) and, preferably, the authenticated user record. For signup, atomically create the account only after email verification, enforce a unique normalized email, and store the requested display name. For login, verify the existing user and issue a short-lived, revocable session. Never trust display names, roles, wallet amounts, or reward values from the client.

## Required security

- Use HTTPS in production, exact CORS allowlists, and server-side rate limits.
- Store only hashed one-time codes, expire them quickly, limit retries, and invalidate a code after successful use.
- Return generic start responses to reduce account enumeration; do not log codes or tokens.
- Keep email delivery and signing secrets on the server. Do not send email credentials to the browser.
- Revoke sessions on sign-out where supported. All wallet, coupon, reward, and withdrawal operations must validate the account server-side.
- The front end stores the returned bearer token in localStorage to remain compatible with the current Ads+ API helper. Before public production, consider a same-site HttpOnly Secure cookie architecture to better limit token exposure to browser scripts.

If `apiBaseUrl` is empty or no email provider/backend is deployed, the UI explains the missing service and will not create a fake account locally.
