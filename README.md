# Rentara Server — Equipment Rental Platform Backend API

[![Express 5](https://img.shields.io/badge/Express-5.3-black.svg?logo=express)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?logo=node.js)](https://nodejs.org/)
[![MongoDB Native](https://img.shields.io/badge/MongoDB-7.9%20Native%20Driver-brightgreen.svg?logo=mongodb)](https://www.mongodb.com/)
[![JWT](https://img.shields.io/badge/Auth-JWT%20Verification-orange.svg?logo=jsonwebtokens)](https://jwt.io/)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout%20API-635bff.svg?logo=stripe)](https://stripe.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless%20API-000000.svg?logo=vercel)](https://rentara-server.vercel.app/)

**Rentara Server** is the high-performance backend API powering the **Rentara Equipment Rental Marketplace**. Built on **Express 5** and the **MongoDB Native Driver**, it provides high-throughput inventory management, multi-criteria server-side filtering, role-based authorization middlewares, Stripe payment escrow handling, real-time analytics aggregation, and automated rental lifecycle transitions.

---

## 🔗 Project Links

| Resource | URL |
| :--- | :--- |
| 🌐 **Live Site Link (Client)** | [https://rentara-client.vercel.app/](https://rentara-client.vercel.app/) |
| 🔗 **Live Server API** | [https://rentara-server.vercel.app/](https://rentara-server.vercel.app/) |
| ⚙️ **GitHub Repository (Server)** | [https://github.com/rubaeitferdous/rentata-server](https://github.com/rubaeitferdous/rentata-server) |
| 💻 **GitHub Repository (Client)** | [https://github.com/rubaeitferdous/rentara-client](https://github.com/rubaeitferdous/rentara-client) |

---

## 🔑 Submission & Evaluation Credentials

Use these verified accounts to test and evaluate role-based API endpoints and dashboard permissions:

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@rentara.com` | `AdminPassword123` | Full Admin Console, User Governance, Catalog Moderation, Platform Turnover Analytics, Global Rental Ledger |
| **Equipment Owner** | `owner@rentara.com` | `OwnerPassword123` | Add & Edit Equipment, Fleet Inventory Management, Incoming Rental Order Fulfillment, Monthly Revenue Analytics |
| **Customer / Renter**| `customer@rentara.com`| `CustomerPassword123`| Public Catalog Browsing, Equipment Booking & Availability Check, Stripe Escrow Checkout, Saved Favorites, Rental Receipts |

---

## 🌟 Key Features & Architecture

### 1. Advanced Search, Filter, Sort & Pagination — *Challenge 1*
- **Full-Text Regex Search:** Dynamic search querying equipment titles, descriptions, and location keywords with regex escaping to prevent injection.
- **Multi-Criteria Filtering:** Filter combinations for:
  - `category`: Category matching across industrial, cinematic, transport, agriculture, electronics, and event gear.
  - `rentalType`: Hourly, Daily, Weekly, or Monthly rental horizons.
  - `minPrice` / `maxPrice`: Strict price bound querying.
  - `availability`: Stock availability filtering (`in-stock`, `out-of-stock`, or `all`).
- **Dynamic Sorting:** Flexible sort parameters (`price-asc`, `price-desc`, `newest`).
- **Server-Side Pagination:** Efficient pagination metadata (`page`, `limit`, `total`, `totalPages`) returning precise sub-slices of data.

### 2. Cryptographic JWT Verification & Role-Based Middlewares — *Challenge 2*
- **Shared Database Authentication:** Shares the MongoDB Atlas cluster with Next.js BetterAuth.
- **Custom Security Middlewares (`middlewares/auth.js`):**
  - `verifyToken`: Extracts and verifies Bearer JWT tokens, loading the live user profile and role from the database.
  - `verifyRenter`: Restricts booking reservations, checkout sessions, and wishlist modifications to active customer accounts.
  - `verifyOwner`: Enforces that only verified gear owners can add, edit, or view incoming fulfillment orders for their own equipment.
  - `verifyAdmin`: Secures administrative user management, equipment catalog approval/rejection queues, and global transaction audits.

### 3. Business & Platform Analytics Aggregation — *Challenge 3*
- **Admin Analytics Engine (`GET /analytics/admin`):**
  - Aggregates platform-wide metrics: Total Users, Total Equipment, Total Bookings, Pending Approvals, Completed Rentals, and Gross Platform Revenue.
  - Computes monthly booking volume and gross revenue trends formatted for frontend Recharts visualization.
- **Owner Analytics Engine (`GET /analytics/owner`):**
  - Owner-specific metrics: Listed Fleet Count, Orders Received, Completed Rentals, and Net Earnings.
  - Computes monthly income breakdowns based on completed and paid rental transactions.

### 4. Overlapping Availability Engine & Stripe Checkout
- **Double-Booking Prevention:** Computes date overlaps `(startDate <= req.endDate AND endDate >= req.startDate)` across active reservations before permitting a booking.
- **Server-Side Authoritative Pricing:** Calculates rental duration in days and computes exact line-item amounts before initializing the Stripe session.
- **Idempotent Payment Confirmation:** Verifies Stripe Checkout sessions directly with Stripe before recording the booking in MongoDB, preventing replay attacks or double-crediting.

### 5. Automated Rental Lifecycle Management
- **Background Cron Job:** Uses `node-cron` on persistent servers to scan and auto-transition `confirmed` rentals to `completed` once their end dates elapse.
- **Lazy Completion Fallback:** Serverless deployments on Vercel run lazy status checks upon analytics and booking fetch queries, ensuring metrics remain 100% accurate without background daemon dependencies.

---

## 📦 NPM Packages & Dependencies

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `express` | `^5.3.0` | High-performance HTTP web framework (Express 5 with native async error handling) |
| `mongodb` | `^7.9.1` | Native MongoDB driver for high-throughput Atlas cluster operations |
| `cors` | `^2.8.6` | Configurable Cross-Origin Resource Sharing with dynamic origin validation |
| `dotenv` | `^18.0.10` | Loads environment variables from local `.env` files into `process.env` |
| `jsonwebtoken` | `^9.0.3` | Cryptographic JWT verification and decoding for authentication |
| `stripe` | `^23.2.0` | Official Stripe SDK for Checkout Session creation and payment validation |
| `node-cron` | `^4.6.0` | Scheduled background task runner for rental status transitions |
| `nodemon` *(dev)* | `^3.1.14` | Development file watcher and auto-reload utility |

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js:** $\ge 20$ (Tested on Node v20+ / v26)
- **MongoDB Atlas** or local MongoDB instance

### 1. Clone the Server Repository
```bash
git clone https://github.com/rubaeitferdous/rentata-server.git
cd rentata-server
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development

# MongoDB Connection String & Database Name
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
DB_NAME=rentara_db

# Shared JWT Secret (Must match JWT_SECRET in rentara-client)
JWT_SECRET=your_synchronized_jwt_secret

# Stripe Secret Key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Client Application URL for CORS & Payment Redirects
CLIENT_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
npm run dev
```
The server will start on [http://localhost:5000](http://localhost:5000) with hot-reload enabled.

### 4. Seed Data & Management Utilities
- **Seed Equipment Catalog:**
  ```bash
  npm run seed
  ```
- **Promote a User to Administrator:**
  ```bash
  npm run make-admin user@example.com
  ```
- **Set Any User Role (`admin`, `owner`, `customer`):**
  ```bash
  node scripts/setRole.js user@example.com <role>
  ```

---

## 📡 Core API Endpoints

### 🩺 Health & Diagnostic
- `GET /` — Service health check returning uptime and status.

### 🚜 Equipment (`/equipment`)
- `GET /equipment` — Public catalog with search, filter, sort & pagination.
- `GET /equipment/featured` — Top 6 approved equipment items.
- `GET /equipment/:id` — Equipment details (Private route; checks approval & role).
- `GET /equipment/mine` — Owner's equipment inventory (`verifyOwner`).
- `POST /equipment` — List new equipment with pending status (`verifyOwner`).
- `PATCH /equipment/:id` — Update equipment details (`verifyOwner` / `verifyAdmin`).
- `DELETE /equipment/:id` — Remove equipment from catalog (`verifyOwner` / `verifyAdmin`).
- `PATCH /equipment/:id/status` — Approve or reject equipment (`verifyAdmin`).

### ❤️ Favorites (`/favorites`)
- `GET /favorites` — Get current customer's saved gear wishlist (`verifyRenter`).
- `POST /favorites` — Add equipment item to saved favorites (`verifyRenter`).
- `DELETE /favorites/:equipmentId` — Remove equipment item from saved favorites (`verifyRenter`).
- `GET /favorites/check/:equipmentId` — Check if an item is currently favorited (`verifyToken`).

### 💳 Payments & Stripe Checkout (`/payments`)
- `POST /payments/checkout` — Validate date availability and create Stripe checkout session (`verifyRenter`).
- `POST /payments/confirm` — Validate Stripe session and record booking with paid status (`verifyToken`).

### 📅 Bookings & Rentals (`/bookings`)
- `GET /bookings/my` — Customer rental history and active receipts (`verifyRenter`).
- `GET /bookings/owner` — Incoming equipment rental fulfillment ledger (`verifyOwner`).
- `GET /bookings/admin` — Global platform transaction ledger (`verifyAdmin`).

### 👥 Users & Accounts (`/users`)
- `GET /users/me` — Current authenticated user profile (`verifyToken`).
- `PATCH /users/profile` — Update user profile details (Name, Phone, Address, Image) (`verifyToken`).
- `GET /users` — Admin view of all registered user accounts (`verifyAdmin`).
- `PATCH /users/:id/role` — Update a user's role (`admin`, `owner`, `customer`) (`verifyAdmin`).
- `DELETE /users/:id` — Delete a user account (`verifyAdmin`).

### 📊 Business Analytics (`/analytics`)
- `GET /analytics/admin` — Platform KPI metrics and monthly booking/turnover trends (`verifyAdmin`).
- `GET /analytics/owner` — Owner revenue metrics and monthly earnings breakdown (`verifyOwner`).

---

## 📁 Project Directory Structure

```
rentara-server/
├── index.js              # Express app initialization, CORS, and route mounting
├── vercel.json           # Vercel serverless deployment routing
├── config/
│   └── db.js             # MongoDB native client connection & database export
├── jobs/
│   └── cron.js           # Automated booking completion cron runner
├── middlewares/
│   └── auth.js           # verifyToken, verifyRenter, verifyOwner, verifyAdmin
├── routes/
│   ├── analytics.js      # Admin & Owner analytics aggregation pipelines
│   ├── bookings.js       # Customer, Owner, and Admin rental ledgers
│   ├── equipment.js      # Public search/filter, CRUD & moderation endpoints
│   ├── favorites.js      # Customer favorites/wishlist management
│   ├── payments.js       # Stripe Checkout Sessions & payment confirmation
│   └── users.js          # Profile updates, admin user table & role assignment
└── scripts/
    ├── makeAdmin.js      # Script to promote any user to admin
    ├── seedEquipment.js  # Database seeder with sample equipment catalog
    └── setRole.js        # Script to set any user role (admin, owner, customer)
```

---

## 🛡️ Security & Architecture Best Practices

- **Strict CORS Policy:** Dynamic origin checking allowing only authorized clients (`https://rentara-client.vercel.app`, local dev origins, and Vercel preview URLs).
- **Stateless Authentication:** Cryptographic JWT verification paired with instant database lookups guarantees real-time permissions without stale credentials.
- **Input Sanitization:** Regex inputs in search endpoints are escaped against ReDoS and query injection.
- **Atomic Operations:** Stripe payments and rental reservations use MongoDB atomic operators to prevent race conditions during booking creation.

---

## 👨‍💻 Author

**Rubaeit Ferdous Himel**  
- **GitHub:** [@rubaeitferdous](https://github.com/rubaeitferdous)  
- **Live Client:** [https://rentara-client.vercel.app/](https://rentara-client.vercel.app/)  
- **Live Server:** [https://rentara-server.vercel.app/](https://rentara-server.vercel.app/)

Created for **Programming Hero Batch 14 - Assignment 9 (Category 003)**.
