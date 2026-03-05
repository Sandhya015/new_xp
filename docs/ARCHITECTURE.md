# Architecture & Design

## Public UI (Reference)

- **Layout**: Similar to shared reference (XpertIntern-style): Hero, About/Why Us, Programs, How It Works, Testimonials, Footer.
- **Internship**: Nav link visible → route `/internship` → “Coming Soon” page only.
- **Branding**: Logo + professional palette (e.g. deep blue + white; accent for CTAs).

## API Design (Backend)

- REST only. JSON in/out.
- Base path: `/api/`.
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me` (JWT).
- Courses: `/api/courses` (list, paginated), `/api/courses/<id>`.
- Internship: `/api/internship` — stub “coming_soon” for now.
- Payments: `/api/payments/create-order`, `/api/payments/verify` (Razorpay flow).
- Health: `GET /api/health`.

## Database (Later)

- MongoDB Atlas. Collections: `users`, `courses`, `enrollments`, `payments`, `internship_applications` (future).
- Indexes on: `email`, `courseId`, `paymentStatus`, `createdAt`.

## Hosting (Cost-Optimized)

- Frontend: Vercel (Git branch → auto deploy).
- Backend: Render or Railway (single service to start).
- DB: MongoDB Atlas M0 free → upgrade when needed.
