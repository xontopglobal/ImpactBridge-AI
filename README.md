# ImpactBridge AI

An AI-assisted giving platform prototype for discovering community initiatives, understanding donation options, and testing PayPal checkout.

## Stack
- React + Vite frontend
- Node.js + Express backend
- PayPal Orders API (Sandbox)
- Optional Supabase persistence
- Optional AI provider through a server-side API endpoint

## Prerequisites
- Node.js 20+ and npm
- A PayPal Developer account for sandbox credentials
- (Optional) Supabase project
- (Optional) AI provider API key and compatible endpoint

## Project structure
```text
impactbridge-ai/
├── client/              # React + Vite
├── server/              # Express API
├── supabase/schema.sql  # Optional database schema
└── README.md
```

## 1. Configure the backend
Open `server/` and copy `.env.example` to `.env`.

Set:
- `PAYPAL_CLIENT_ID`: PayPal Sandbox app client ID
- `PAYPAL_CLIENT_SECRET`: PayPal Sandbox app secret
- `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`
- `CLIENT_ORIGIN=http://localhost:5173`
- `PORT=8787`

Never put the PayPal secret in the frontend or commit `.env`.

## 2. Configure the frontend
Open `client/` and copy `.env.example` to `.env`.
Set `VITE_API_URL=http://localhost:8787` and `VITE_PAYPAL_CLIENT_ID` to the same **sandbox client ID** used by the backend.

## 3. Install and run
Use two terminals.

Terminal 1:
```bash
cd server
npm install
npm run dev
```

Terminal 2:
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in the terminal (normally http://localhost:5173).

## 4. Test PayPal Sandbox
1. Create a REST app in the PayPal Developer Dashboard using Sandbox.
2. Copy the Sandbox Client ID and Secret into `server/.env`.
3. Put the Sandbox Client ID in `client/.env`.
4. Restart both servers.
5. Select an initiative and click **Continue with PayPal**.
6. Approve with a PayPal Sandbox buyer account. The backend captures the order and validates the returned status.

Until valid sandbox credentials are supplied, the application still runs in demo mode, but PayPal checkout will show a configuration message instead of pretending a payment succeeded.

## AI behaviour
The built-in assistant works in local demo mode using the initiative data bundled with the app. For a real model, configure `AI_API_URL` and `AI_API_KEY` in `server/.env` for an OpenAI-compatible chat completions endpoint. The backend only sends user prompts and public initiative data; never put model secrets in frontend environment variables.

## Optional Supabase
Run `supabase/schema.sql` in the Supabase SQL Editor. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` only if you implement server-side persistence. Keep the service-role key private. The prototype works without Supabase credentials.

## Deployment
- Frontend: deploy `client/` to Vercel. Set `VITE_API_URL` to your Render backend URL and `VITE_PAYPAL_CLIENT_ID` to the PayPal Sandbox client ID.
- Backend: deploy `server/` to Render. Build command: `npm install`; start command: `npm start`. Set environment variables from `server/.env.example`, using the deployed Vercel URL for `CLIENT_ORIGIN`.
- Set `NODE_VERSION` to a supported Node 20+ version if needed.
- Do not commit `.env` files.

## Important limitations
- This is a hackathon prototype, not a production donation processor.
- Sandbox transactions are test transactions, not real donations.
- Impact estimates are illustrative and must not be presented as verified outcomes.
- Before production use, add persistent transaction storage, webhooks, idempotency, fraud controls, monitoring, privacy review, and appropriate legal/compliance checks.
