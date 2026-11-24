# Loopback

```
loopback/
├── server/   server.js · package.json · .env.example
└── public/   index.html · styles.css · app.js
```

## Run

```bash
cd server
cp .env.example .env     # set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm start                # http://localhost:3000
```

- No demo accounts. The admin is created once on first start from `ADMIN_EMAIL` / `ADMIN_PASSWORD`; everyone else signs up.
- Data lives in a SQLite file (`DB_FILE`). Back it up.

## Before going live

- Serve over HTTPS (reverse proxy such as Nginx or Caddy).
- Payments are simulated: replace `/api/wallet/topup` with a verified gateway webhook (e.g. Razorpay) and handle real payouts for withdrawals.
- Have the privacy policy reviewed legally.
- Add email verification and password reset.
