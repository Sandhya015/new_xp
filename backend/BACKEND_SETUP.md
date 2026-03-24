# XpertIntern Flask API — Setup & Run

## 1. Prerequisites

- Python 3.11+
- MongoDB Atlas cluster (connection string ready)
- (Optional) `.env` in `backend/` with `MONGODB_URI` and `SECRET_KEY`

## 2. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

- **MONGODB_URI** — Your Atlas connection string (replace `<password>` with the DB user password). Example:
  `mongodb+srv://xpertintern_app:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/xpertintern?retryWrites=true&w=majority`
- **SECRET_KEY** — Random string for JWT/session (e.g. `openssl rand -hex 32`)
- **CORS_ORIGINS** — Comma-separated frontend URLs, e.g. `http://localhost:5173,http://127.0.0.1:5173`

## 4. Run the API

```bash
python run.py
```

Or:

```bash
export FLASK_APP=run.py
flask run --host=0.0.0.0 --port=5000
```

API base URL: **http://localhost:5000**

## 5. Auth endpoints (implemented)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (student or company). Body: `name`, `email`, `password`, `mobile?`, `role?`, `hrName?` |
| POST | `/api/auth/login` | Login. Body: `email`, `password`. Returns `token` + `user` |
| GET | `/api/auth/me` | Current user (header: `Authorization: Bearer <token>`) |
| POST | `/api/auth/refresh` | New token (header: `Authorization: Bearer <token>`) |

## 6. Frontend integration

- In the frontend project root, create `.env` (or `.env.local`) with:
  - `VITE_API_URL=http://localhost:5000` (so the React app calls this API).
- Run frontend: `cd frontend && npm run dev`.
- Use **Login** and **Register**; they call the Flask API and store the JWT and user.

## 7. Razorpay (training payments)

1. Create a [Razorpay](https://razorpay.com/) account and open **Settings → API Keys**.
2. Use **Test mode** keys for local development (`rzp_test_...`).
3. Add to `backend/.env` (never commit real secrets):

   ```bash
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=your_key_secret
   ```

4. Install the SDK (included in `requirements.txt`):

   ```bash
   pip install -r requirements.txt
   ```

5. **Flow:** Student must be logged in (JWT). **POST `/api/payments/create-order`** with `{ "courseId": "<mongo id>" }` — amount is read from the course document in INR (converted to paise for Razorpay). Client opens Razorpay Checkout, then **POST `/api/payments/verify`** with `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. On success the order is marked paid and an **enrollment** is created if one does not exist.
6. **Free courses** (`price` 0 or missing): do not call Razorpay; use **POST `/api/enrollments`** with `{ "courseId" }` (same as the Training page “Enroll free” flow).
7. For Lambda/production, set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the function environment (prefer **Secrets Manager** for the secret).

**Local test checklist**

- [ ] Course in MongoDB has `price` ≥ 1 and `active: true`.
- [ ] Student registered and JWT present in the frontend.
- [ ] Training page → Enroll → Razorpay test UPI/card from [Razorpay test data](https://razorpay.com/docs/payments/payments/test-card-details/).

---

## 8. Deploying the API to AWS (no always-on server, no loops)

The API can be deployed to **AWS Lambda + API Gateway** so it runs only when a request is made (pay-per-request, no idle cost).

- See **[DEPLOY_AWS.md](./DEPLOY_AWS.md)** for step-by-step: install Serverless, set env vars, deploy, and point the frontend to the new API URL (include Razorpay keys in Lambda env or SSM).
- Set **MONGODB_URI**, **SECRET_KEY**, and **CORS_ORIGINS** (your live frontend URL) when deploying.
- In MongoDB Atlas → Network Access, allow `0.0.0.0/0` (or your Lambda egress IPs) so the API can reach the database.
