# XpertIntern — Project Structure (per Tech Stack Guide)

## Frontend (xpertintern-frontend)

```
frontend/
├── public/
│   └── logo.png          # Add client logo here
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── layout/       # Navbar, Footer, Layout
│   │   ├── CourseCard.jsx
│   │   └── Notification.jsx
│   ├── pages/
│   │   ├── public/       # No auth required
│   │   │   ├── Home.tsx, About.tsx, Contact.tsx
│   │   │   ├── Training.tsx, CourseDetail.tsx
│   │   │   ├── Internship.tsx (Coming Soon)
│   │   │   ├── CertVerify.tsx, Login.tsx, Register.tsx
│   │   ├── student/      # Protected
│   │   │   ├── Dashboard.tsx, MyCourses.tsx
│   │   │   ├── CourseContent.tsx, Invoices.tsx, Notifications.tsx
│   │   └── admin/        # Admin protected
│   │       ├── AdminDashboard.tsx, CourseManager.tsx
│   │       ├── StudentList.tsx, CertificateUpload.tsx
│   │       ├── LeadTracker.tsx, PaymentList.tsx
│   ├── hooks/            # useAuth, etc.
│   ├── store/            # Zustand authStore
│   ├── services/         # authService, courseService, paymentService
│   ├── utils/            # constants, helpers
│   ├── App.tsx, main.tsx, index.css
├── .env.example
├── vite.config.ts, tailwind.config.js
└── package.json
```

## Backend (xpertintern-backend)

```
backend/
├── app/
│   ├── __init__.py       # Flask app factory
│   ├── config.py         # Environment config (dev/staging/production)
│   ├── models/           # MongoDB document models (stub)
│   ├── routes/           # API blueprints
│   │   ├── auth.py       # /api/auth/*
│   │   ├── courses.py    # /api/courses/*
│   │   ├── enrollments.py
│   │   ├── payments.py   # Razorpay
│   │   ├── certificates.py
│   │   ├── admin.py
│   │   ├── contact.py
│   │   ├── visitor.py    # /api/track
│   │   └── internship.py
│   ├── services/         # email_service, invoice_service, excel_service (stub)
│   └── utils/            # jwt_helpers, validators (stub)
├── requirements.txt
├── run.py
├── .env.example
└── Dockerfile            # For Render deployment (add when needed)
```

## Routes (Guide alignment)

| Page / API        | Route                          | Auth    |
|-------------------|---------------------------------|--------|
| Home              | `/`                             | Public |
| About             | `/about`                        | Public |
| Contact           | `/contact`                      | Public |
| Training          | `/training`                     | Public |
| Course Detail     | `/training/:id`                | Public |
| Internship        | `/internship` (Coming Soon)     | Public |
| Verify Certificate| `/verify`                      | Public |
| Login / Register  | `/login`, `/register`           | Public |
| Student Dashboard | `/dashboard`, `/dashboard/*`   | Student|
| Admin             | `/admin`, `/admin/*`            | Admin  |

API base: `/api/*` (health, auth, courses, enrollments, payments, certificates, admin, contact, track, internship).
