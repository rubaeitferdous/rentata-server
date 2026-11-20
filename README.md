# Rentara Server — Equipment Rental Platform API

Rentara API is the backend service powering the **Rentara Equipment Rental Marketplace**, connecting equipment owners with renters through secure inventory management, server-side filtering, role-based access control, and Stripe payment integration.

---

## 📌 Project Overview
- **Project Name:** Rentara Server (Assignment 9 - Category 003)
- **Live API Endpoint:** `https://YOUR-RENTARA-API.vercel.app` (or `http://localhost:5000` locally)
- **Primary Client:** [Rentara Client (Next.js)](http://localhost:3000)
- **Architecture:** Express 5 on Node.js (ES Modules) + MongoDB Native Driver + JWT Authentication + Stripe Payments.

---

## 🌟 Key Features

### 1. Server-Side Search, Filter, Sort & Pagination (Challenge 1)
- Dynamic search querying equipment title, location, and category with regex escaping.
- Multi-criteria filtering: category, rental type (Daily, Weekly, Monthly), price range bounds, and availability.
- Sorting options: Price Low-to-High, Price High-to-Low, and Recently Added.
- Pagination with customizable page and limit boundaries.

### 2. JWT Verification & Role-Based Access Control (Challenge 2)
- Unified MongoDB user database shared with Next.js BetterAuth.
- Custom Express middlewares:
  - `verifyToken`: Validates Bearer JWT and pulls real-time user record and roles from MongoDB.
  - `verifyRenter`: Restricts booking and favorites actions to Customer accounts.
  - `verifyOwner`: Protects inventory submission, modification, and incoming rental ledger.
  - `verifyAdmin`: Secures administrative user management, equipment approvals, and global transaction ledger.

### 3. Business & Platform Analytics (Challenge 3)
- **Admin Analytics:** Platform-wide metrics including total users, total equipment, total bookings, pending approvals, completed rentals, gross platform revenue, and monthly booking & revenue trends.
- **Owner Analytics:** Owner-specific metrics including total listed equipment, bookings count, completed rentals, net earnings, and monthly earnings breakdown.

### 4. Overlapping Availability & Payment Flow
- Server-side calculation engine preventing equipment double-booking by computing overlapping dates `(startDate <= req.endDate AND endDate >= req.startDate)`.
- Authoritative rental price calculation on the server before generating Stripe Checkout session.
- Idempotent payment confirmation endpoint updating booking status and recording payment transactions.

### 5. Automated Booking Lifecycle Management
- Background cron job via `node-cron` scanning and auto-transitioning `confirmed` bookings to `completed` once the rental end date elapses.
- Lazy completion hooks on analytics and booking fetch queries ensuring accuracy on serverless environments.

---

## 📦 NPM Packages Used

| Package | Version | Purpose |
|---|---|---|
| `express` | `^5.3.0` | High-performance HTTP server framework |
| `mongodb` | `^7.9.1` | Native MongoDB driver for Atlas cluster integration |
| `cors` | `^2.8.6` | Cross-Origin Resource Sharing middleware |
| `dotenv` | `^18.0.10` | Environment variable loader |
| `jsonwebtoken` | `^9.0.3` | JWT signature verification for client-server auth bridge |
| `stripe` | `^23.2.0` | Stripe Checkout Sessions and payment verification |
| `node-cron` | `^4.6.0` | Scheduled background task runner for booking completion |
| `nodemon` (dev) | `^3.1.14` | Hot-reloading development server |

---

## 🚀 Getting Started Locally

### 1. Clone & Install Dependencies
```bash
cd rentara-server
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root of `rentara-server/`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
DB_NAME=rentara_db
JWT_SECRET=your_shared_jwt_secret
STRIPE_SECRET_KEY=sk_test_your_stripe_secret
CLIENT_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

### 4. Utility Scripts
- **Seed Equipment:**
  ```bash
  npm run seed
  ```
- **Promote User to Admin:**
  ```bash
  npm run make-admin user@example.com
  ```

---

## 📡 Core API Endpoints

### Equipment (`/equipment`)
- `GET /equipment` — Public search, filter, sort & paginated equipment list.
- `GET /equipment/featured` — 6 approved items (using MongoDB limit).
- `GET /equipment/:id` — Equipment details (Private route, checks approval & role).
- `GET /equipment/mine` — Owner's listed equipment (`verifyOwner`).
- `POST /equipment` — List new equipment with pending status (`verifyOwner`).
- `PATCH /equipment/:id` — Update equipment details (`verifyOwner` / `verifyAdmin`).
- `DELETE /equipment/:id` — Delete equipment (`verifyOwner` / `verifyAdmin`).
- `PATCH /equipment/:id/status` — Approve or reject equipment (`verifyAdmin`).

### Favorites (`/favorites`)
- `GET /favorites` — Get current customer's saved equipment items.
- `POST /favorites` — Add equipment to favorites.
- `DELETE /favorites/:equipmentId` — Remove equipment from favorites.
- `GET /favorites/check/:equipmentId` — Check if equipment is favorited.

### Payments & Checkout (`/payments`)
- `POST /payments/checkout` — Validate dates/stock and create Stripe checkout session.
- `POST /payments/confirm` — Validate Stripe session and record booking + payment.

### Bookings (`/bookings`)
- `GET /bookings/my` — Customer rental history (`verifyRenter`).
- `GET /bookings/owner` — Owner incoming rentals (`verifyOwner`).
- `GET /bookings/admin` — Global rental transactions ledger (`verifyAdmin`).

### Users & Profiles (`/users`)
- `GET /users/me` — Current user profile details.
- `PATCH /users/profile` — Update phone, address, name, or profile photo.
- `GET /users` — Admin view of all registered accounts (`verifyAdmin`).
- `PATCH /users/:id/role` — Admin role assignment (`verifyAdmin`).
- `DELETE /users/:id` — Admin account deletion (`verifyAdmin`).

### Analytics (`/analytics`)
- `GET /analytics/admin` — Platform KPI metrics and monthly trends (`verifyAdmin`).
- `GET /analytics/owner` — Owner revenue and booking volume stats (`verifyOwner`).
