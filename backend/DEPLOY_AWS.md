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

## 4. Point the frontend to the deployed API

In your **frontend** (e.g. Vercel):

- Set `VITE_API_URL` to the API base URL above (no trailing slash), e.g.  
  `VITE_API_URL=https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev`
- Redeploy the frontend so it uses the new API.

## 5. Other stages (staging / production)

Use a different stage so you can have separate APIs (e.g. staging vs production):

```bash
npx serverless deploy --stage staging
npx serverless deploy --stage production
```

Set `MONGODB_URI`, `SECRET_KEY`, and `CORS_ORIGINS` per stage (e.g. different CORS for staging vs production frontend URLs). You can use AWS Systems Manager Parameter Store or Secrets Manager and reference them in `serverless.yml` instead of exporting in the shell.

## 6. No loops / no scheduled jobs

- There are **no** cron or scheduled Lambda triggers in this setup.
- Lambda runs only when API Gateway receives an HTTP request.
- Your Flask code (including `seed_admin_if_missing`) runs only on **cold start** or when a request is handled; there is no polling or infinite loop.

## 7. Optional: keep secrets in AWS

To avoid passing secrets via the shell:

1. **SSM Parameter Store** (e.g. `/xpertintern/dev/MONGODB_URI`).
2. In `serverless.yml` under `provider.environment`:

   ```yaml
   MONGODB_URI: ${ssm:/xpertintern/${self:provider.stage}/MONGODB_URI}
   SECRET_KEY: ${ssm:/xpertintern/${self:provider.stage}/SECRET_KEY}
   CORS_ORIGINS: ${ssm:/xpertintern/${self:provider.stage}/CORS_ORIGINS}
   ```

3. Create the parameters in AWS (Console or CLI) and deploy again.

## 8. Summary

| Step | Action |
|------|--------|
| 1 | Install Serverless: `npm install -g serverless` |
| 2 | Set `MONGODB_URI`, `SECRET_KEY`, `CORS_ORIGINS` (and optionally `JWT_SECRET_KEY`) |
| 3 | From `backend/`: `npx serverless deploy --stage dev` |
| 4 | Copy the API base URL and set `VITE_API_URL` in the frontend (e.g. Vercel env) |
| 5 | Redeploy frontend; test login/register against the new API |

Your API is then hosted on AWS with **no always-on process and no background loops** — only pay per request.
