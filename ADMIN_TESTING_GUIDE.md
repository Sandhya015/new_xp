# Admin Panel — API Integration Testing Guide

Use this guide to test the admin APIs and UI end-to-end (local backend + frontend).

---

## 1. Prerequisites

- **Backend** running locally: from `backend/` run  
  `source venv/bin/activate` (or `venv\Scripts\activate` on Windows), set env vars (see below), then  
  `python run.py` (or `flask run`). Default: http://localhost:5000  
- **Frontend** running: from `frontend/` run `npm run dev`. Default: http://localhost:5173  
- **Admin login**: email `admin@xpertintern.com`, password `Admin@xpertintern` (from seed).  
- **Env (backend)** e.g. in `backend/.env`:  
  `MONGODB_URI`, `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS=http://localhost:5173`

---

## 2. Login & Dashboard

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Browser | Open http://localhost:5173 and go to Admin login (e.g. /admin/login) | Admin login page |
| 2 | Login | Log in with `admin@xpertintern.com` / `Admin@xpertintern` | Redirect to admin dashboard |
| 3 | Dashboard | Check Dashboard (first page after login) | KPI cards with real numbers (students, trainings, companies, revenue, etc.), Pending Approvals list, Recent Activity, Quick Actions |
| 4 | API | In DevTools Network, confirm requests to `/api/admin/dashboard` | 200, JSON with `kpis`, `pendingItems`, `recentActivity` |

**If dashboard shows “Failed to load dashboard”**  
- Backend not running or wrong URL (frontend should use http://localhost:5000 when host is localhost).  
- Check `frontend/src/config/api.ts`: local dev uses `LOCAL_API_URL` when host is localhost.  
- Check backend logs and CORS (CORS_ORIGINS must include http://localhost:5173).

---

## 3. Students

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Sidebar | Click **Students** (or go to /admin/students) | List of students from API |
| 2 | List | Use search if available | Filtered list |
| 3 | Detail | Click **View profile** (or open /admin/students/:id) for one student | Student detail: profile, enrollments, applications from API |
| 4 | API | In Network tab | `GET /api/admin/students` (list), `GET /api/admin/students/:id` (detail) return 200 |

---

## 4. Leads

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Sidebar | Click **Leads** (or /admin/leads) | List of leads (contact form submissions) |
| 2 | Tabs / filters | Change status filter if present | List updates |
| 3 | Detail | Click **View** for one lead (or /admin/leads/:id) | Lead detail with contact info, status dropdown, Follow-up timeline |
| 4 | Status | Change status in dropdown | PATCH to `/api/admin/leads/:id` with new status; list/detail refresh |
| 5 | Assign | Click **Assign**, enter a name, Confirm | Lead’s “Assigned to” updates |
| 6 | Follow-up | Click **Add Follow-up**, choose type and notes, Save | New entry in Follow-up timeline; POST/PATCH to API |

---

## 5. Payments

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Sidebar | Click **Payments** (or /admin/payments) | List of payments/orders |
| 2 | Detail | Click **View** (or /admin/payments/:id) | Payment detail: amount, student, status, etc. |
| 3 | Verify | Click **Mark as Verified** | Status becomes success; `POST /api/admin/payments/:id/verify` |
| 4 | Refund | Click **Process Refund**, enter reason (required), optional amount and gateway ref, Submit | Status becomes refunded; `POST /api/admin/payments/:id/refund` |

---

## 6. Companies

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Sidebar | Click **Companies** (or /admin/companies) | Tabs: Pending Approval, Active, Suspended |
| 2 | Tabs | Switch between Pending / Active / Suspended | List from API for that status (Active includes companies with no status) |
| 3 | Review | Click **Review** (eye) on a row | Modal with company detail from `GET /api/admin/companies/:id` |
| 4 | Approve | On a pending company, click **Approve** (in table or in modal) | Company moves to Active; list refreshes |
| 5 | Reject | Click **Reject**, enter reason, Submit | Company status rejected; modal closes, list refreshes |
| 6 | Request info | Click **Request More Info**, enter message, Send | `POST /api/admin/companies/:id/request-info` |

---

## 7. Internships (Admin moderation)

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Sidebar | Click **Internships** (or /admin/internships) | Tabs: Pending Approval, Active, Closed |
| 2 | Tabs | Switch tabs | List from `GET /api/admin/internships?status=...` |
| 3 | View | Click **View** (eye) on a row | Modal with full listing from `GET /api/admin/internships/:id` |
| 4 | Approve | On pending, click **Approve** | Listing becomes active |
| 5 | Reject | Click **Reject**, enter reason, Submit | Listing rejected; list refreshes |
| 6 | Feature | On active listing, click **Feature** | `POST /api/admin/internships/:id/feature` |
| 7 | Force close | Click **Force Close** | Listing closed; `POST /api/admin/internships/:id/force-close` |

---

## 8. Certificates

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Sidebar | Open **Certificates** (or /admin/certificates) | Tabs: Generate by Batch, Generate by Excel, Certificate Register |
| 2 | Batch tab | Open “Generate by Batch” | **Training Program** dropdown populated from `GET /api/admin/certificates/trainings` |
| 3 | Register tab | Open “Certificate Register” | Table of certificates from `GET /api/admin/certificates` |
| 4 | Register | Use search and status filter (Valid / Revoked) | Table updates from API |

---

## 9. Courses / Training

| Step | Where | What to do | What to see |
|------|--------|------------|-------------|
| 1 | Sidebar | Click **Courses** or **Training** (or /admin/courses) | List of courses from API |
| 2 | Detail | Open a course detail/manage page if link exists (e.g. /admin/courses/:id/manage) | Course data from `GET /api/admin/courses/:id` |

---

## 10. Quick checklist (smoke test)

- [ ] Admin login works.  
- [ ] Dashboard loads KPIs, pending items, recent activity.  
- [ ] Students list and student detail load.  
- [ ] Leads list and lead detail load; status change and follow-up work.  
- [ ] Payments list and payment detail load; verify and refund work.  
- [ ] Companies list by tab; approve/reject/request-info work.  
- [ ] Internships list by tab; approve/reject/feature/force-close work.  
- [ ] Certificates: trainings dropdown and register table load.

---

## 11. Where to add / what to set

- **Backend base URL (frontend)**  
  - Local: ensured by `frontend/src/config/api.ts` when host is localhost (uses http://localhost:5000).  
  - For a deployed frontend pointing to your API, set `VITE_API_URL` in the build/hosting env to your API base (e.g. `https://your-api.execute-api.region.amazonaws.com/dev`).

- **Admin user**  
  - Created by seed: `admin@xpertintern.com` / `Admin@xpertintern`.  
  - To reseed (e.g. after DB reset): run backend once with seed (e.g. `seed_admin_if_missing` on app init) or run your seed script.

- **Test data**  
  - Students: register via public registration.  
  - Leads: submit contact form on public site.  
  - Payments: create orders in DB or via your payment flow.  
  - Companies: register as company (new ones get status “pending”).  
  - Internships: post as company; for “Pending Approval” ensure backend sets `status: "pending_approval"` when you want moderation.

---

## 12. Common issues

- **401 Unauthorized**  
  - Not logged in or token expired. Log in again as admin.

- **403 Forbidden**  
  - User is not admin. Use admin account.

- **CORS errors**  
  - Backend `CORS_ORIGINS` must include the frontend origin (e.g. http://localhost:5173).  
  - No trailing slash in origin.

- **Dashboard or lists empty**  
  - Normal if DB has no data. Add data via registration, contact form, or seed.  
  - Check backend logs and Network tab for 503/500 (e.g. DB not configured).

- **Companies “Active” tab empty**  
  - Backend treats missing `status` as active for listing. If you still see none, check DB for `users` with `role: "company"`.

---

**Summary:** Start backend and frontend, log in as admin, then go through each section above. Use Network tab to confirm the correct admin API endpoints are called and return 200 where expected.
