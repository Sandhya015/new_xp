# XpertIntern — Training & Internship Platform

Enterprise-grade training and internship platform (AICTE/UGC compliant). Target scale: **25,000+ students**. Cost-optimized stack.

---

## Architecture Overview

| Layer        | Stack              | Hosting (Suggested) | Cost (Initial) |
|-------------|--------------------|---------------------|-----------------|
| **Frontend** | React 18 + Vite + Tailwind CSS | Vercel (CDN) | Free |
| **Backend**  | Flask 3.x (REST API)           | Render / Railway   | ~₹1,000/mo      |
| **Database** | MongoDB Atlas                 | Atlas M0 → M10     | Free → scale    |
| **Payments** | Razorpay (preferred) / PayU   | —                  | Per transaction |

---

## Repository Structure

```
neww_xp/
├── frontend/          # React (Vite) + Tailwind — public site + auth UI
├── backend/           # Flask API — auth, courses, internship, payments
├── README.md
└── docs/              # (optional) API spec, DB schema
```

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **MongoDB** (local or Atlas) — when DB is connected

---

## Quick Start

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173` (or Vite’s next available port).

### Backend (dev)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # optional; edit for CORS etc.
python run.py
```

Or: `FLASK_APP=run:app flask run`

API at `http://127.0.0.1:5000`. Health: `GET /api/health`.

---

## Environments

- **dev** — local frontend + backend, optional local MongoDB
- **staging** — Vercel + Render + Atlas (staging DB)
- **production** — same stack, production DB and secrets

Never hardcode stage-specific values in code; use env vars and config objects.

---

## Alignment with Tech Stack Guide

This repo follows the **XpertIntern Platform — Tech Stack, Architecture & Cost Planning Guide** (March 2026): frontend `pages/public/`, `pages/student/`, `pages/admin/`; backend `app/config.py`, `app/routes/`, `app/models/`, `app/services/`, `app/utils/`. See `docs/PROJECT_STRUCTURE.md`.

## Key Features (Planned)

- [x] Public landing (Hero, Why Choose Us, Training, Testimonials)
- [x] Public pages: About, Contact, Training, Course Detail, Internship (Coming Soon), Cert Verify, Login, Register
- [x] Student & Admin dashboard placeholders; backend route stubs for all API groups
- [ ] Auth API + JWT + DB; Courses API + MongoDB; Razorpay; route guards

---

## Security & Scale (Target 25k Students)

- JWT auth, bcrypt for passwords
- Rate limiting on auth/payment endpoints
- Pagination on all list APIs
- DB indexes: `email`, `courseId`, `paymentStatus`
- CORS and env-based config only

---

## Payment Gateway

**Razorpay** recommended (docs, dashboard, startup-friendly). PayU supported as alternative.

---

## License & Contact

Proprietary — client project. Domain: Namecheap (configure when hosting is decided).
