# Ads+ User App — UI Prototype

A mobile-first React + Vite front-end prototype for Ads+. It includes Home, Earnings, Wallet, Creator Codes, Profile and Help screens. The visual theme uses brown (`#6F4E37`), platinum (`#E5E4E2`) and soft lavender (`#E6E0F0`).

## Important status

This is a **front-end demo only**. Balances and event rows are illustrative sample values. Authentication, real advertiser events, fraud checks, server-side reward calculations, creator-code validation, extension sync and payouts are not connected. The withdrawal interaction creates a local preview only; it does not send a payment request. Do not treat the sample balance as real funds.

## Requirements

- Node.js and npm (Termux's `nodejs-lts` package is suitable)
- `unzip`
- Internet during `npm install` to download project dependencies

## Run in Termux (Android)

1. Download `AdsPlus-User-App.zip` into Android's Downloads folder.
2. In Termux, allow storage access once:
   ```sh
   termux-setup-storage
   ```
3. Install tools if needed:
   ```sh
   pkg update
   pkg install nodejs-lts unzip -y
   ```
   If `node -v` and `npm -v` already work, you can skip installing Node again.
4. Unpack the ZIP in your home directory:
   ```sh
   cd ~
   unzip -o ~/storage/downloads/AdsPlus-User-App.zip -d ~
   cd ~/adsplus-user-app
   ```
5. Install dependencies and build:
   ```sh
   npm install
   npm run build
   ```
6. Start the local development server:
   ```sh
   npm run dev -- --host 0.0.0.0
   ```
7. Open the `Local` URL shown by Vite, usually `http://localhost:5173/`, in the phone browser. Keep Termux running while you use the app.

## Main files

- `src/main.jsx` — app screens and local demo interactions
- `src/styles.css` — responsive theme and page styles
- `public/favicon.svg` — Ads+ mark
- `index.html` — browser entry document

## Safe project boundaries

Unzip creates `~/adsplus-user-app`. It does not modify `~/adsplusstart`, A1 AI or Neon AI. If the destination folder already exists and you need to keep its contents, back it up before extracting.
