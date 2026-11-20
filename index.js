import "dotenv/config";
import express from "express";
import cors from "cors";

import equipmentRoutes from "./routes/equipment.js";
import favoritesRoutes from "./routes/favorites.js";
import paymentsRoutes from "./routes/payments.js";
import bookingsRoutes from "./routes/bookings.js";
import usersRoutes from "./routes/users.js";

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation"), false);
    },
    credentials: true,
  })
);

app.use(express.json());

// Base health check route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    message: "Rentara Equipment Rental API is operational",
    timestamp: new Date().toISOString(),
  });
});

// Equipment Routes (Public search/filter, Owner listings, Admin approvals)
app.use("/equipment", equipmentRoutes);
app.use("/favorites", favoritesRoutes);
app.use("/payments", paymentsRoutes);
app.use("/bookings", bookingsRoutes);
app.use("/users", usersRoutes);

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    error: err.name || "InternalServerError",
    message: err.message || "An unexpected server error occurred",
  });
});

if (!process.env.VERCEL) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Rentara API server running on port ${port}`);
  });
}

export default app;
