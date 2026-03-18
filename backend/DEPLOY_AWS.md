# Deploy XpertIntern API to AWS (Lambda + API Gateway)

The API runs **only when a request is made** — no always-on server, no loops, no idle cost. You pay per request (and for MongoDB Atlas as you already have).

## What gets deployed

| AWS resource   | Purpose                          |
|----------------|----------------------------------|
| **Lambda**     | Runs your Flask app per request  |
| **API Gateway**| HTTP endpoint that triggers Lambda |

No EC2, no 24/7 process, no cron/scheduled jobs.

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Node.js (for Serverless Framework)
- Backend `.env` or env vars for `MONGODB_URI`, `SECRET_KEY`, `CORS_ORIGINS`

## 1. Install Serverless Framework

```bash
npm install -g serverless
# or
npx serverless --version
```

## 2. Set environment variables for deploy

Either export before deploy or use a `.env` file (do **not** commit secrets).

**Required:**

- `MONGODB_URI` — Your MongoDB Atlas connection string (same as local).  
  In Atlas: Network Access → allow `0.0.0.0/0` so Lambda can connect, or restrict to AWS IPs if you prefer.
- `SECRET_KEY` — Strong random key (e.g. `openssl rand -hex 32`). Use the same for `JWT_SECRET_KEY` if you don’t set it.
- `CORS_ORIGINS` — Your **live frontend URL(s)** comma-separated, e.g.  
  `https://your-app.vercel.app,https://www.xpertintern.com`

Example (run from your machine, not committed):

```bash
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/xpertintern?retryWrites=true&w=majority"
export SECRET_KEY="your-production-secret-key"
export JWT_SECRET_KEY="$SECRET_KEY"
export CORS_ORIGINS="https://your-frontend.vercel.app"
```

## 3. Deploy from backend directory

```bash
cd backend
npx serverless deploy --stage dev
```

First run can take a few minutes (build + upload). When it finishes you’ll see something like:

```text
endpoints:
  ANY - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/{proxy+}
  ANY - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev
```

That base URL is your **API base URL** (e.g. `https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev`).

## 4. Set Lambda environment variables (required for login/API to work)

After the first deploy, the API may return **503** until these are set. In AWS Console:

1. Go to **Lambda** → **Functions** → **xpertintern-api-dev-api** (or your stage name).
2. **Configuration** → **Environment variables** → **Edit**.
3. Add (or update):

| Key | Value (example — use your real values) |
|-----|----------------------------------------|
| `MONGODB_URI` | `mongodb+srv://xpertintern_app:<db_password>@cluster0.yhkeqow.mongodb.net/xpertintern?retryWrites=true&w=majority&appName=Cluster0` — replace `<db_password>` with your Atlas DB user password. |
| `JWT_SECRET_KEY` | A long random string (e.g. run `openssl rand -hex 32` and paste). |
| `SECRET_KEY` | Same as JWT or another secret. |

4. **Save**. No redeploy needed; Lambda uses the new values on the next request.

- **MongoDB Atlas**: In **Network Access**, allow `0.0.0.0/0` (or your Lambda/NAT IPs) so Lambda can reach Atlas.
- **Never** put AWS access keys or DB passwords in code or in git. Use Console or SSM/Secrets Manager.

## 5. Point the frontend to the deployed API

In your **frontend** (e.g. Vercel):

- Set `VITE_API_URL` to the API base URL above (no trailing slash), e.g.  
  `VITE_API_URL=https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev`
- Redeploy the frontend so it uses the new API.

## 6. Other stages (staging / production)

Use a different stage so you can have separate APIs (e.g. staging vs production):

```bash
npx serverless deploy --stage staging
npx serverless deploy --stage production
```

Set `MONGODB_URI`, `SECRET_KEY`, and `CORS_ORIGINS` per stage (e.g. different CORS for staging vs production frontend URLs). You can use AWS Systems Manager Parameter Store or Secrets Manager and reference them in `serverless.yml` instead of exporting in the shell.

## 7. No loops / no scheduled jobs

- There are **no** cron or scheduled Lambda triggers in this setup.
- Lambda runs only when API Gateway receives an HTTP request.
- Your Flask code (including `seed_admin_if_missing`) runs only on **cold start** or when a request is handled; there is no polling or infinite loop.

## 8. Optional: keep secrets in AWS

To avoid passing secrets via the shell:

1. **SSM Parameter Store** (e.g. `/xpertintern/dev/MONGODB_URI`).
2. In `serverless.yml` under `provider.environment`:

   ```yaml
   MONGODB_URI: ${ssm:/xpertintern/${self:provider.stage}/MONGODB_URI}
   SECRET_KEY: ${ssm:/xpertintern/${self:provider.stage}/SECRET_KEY}
   CORS_ORIGINS: ${ssm:/xpertintern/${self:provider.stage}/CORS_ORIGINS}
   ```

3. Create the parameters in AWS (Console or CLI) and deploy again.

## 9. Summary

| Step | Action |
|------|--------|
| 1 | Install Serverless: `npm install -g serverless` |
| 2 | Set `MONGODB_URI`, `SECRET_KEY`, `CORS_ORIGINS` (and optionally `JWT_SECRET_KEY`) |
| 3 | From `backend/`: `npx serverless deploy --stage dev` |
| 4 | In Lambda Console, set `MONGODB_URI` and `JWT_SECRET_KEY` (see step 4 above). |
| 5 | Copy the API base URL and set `VITE_API_URL` in the frontend (e.g. Vercel env). |
| 6 | Redeploy frontend; test login/register against the new API. |

Your API is then hosted on AWS with **no always-on process and no background loops** — only pay per request.
