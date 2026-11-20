import jwt from "jsonwebtoken";
import { col } from "../config/db.js";

/**
 * verifyToken
 * Validates the Authorization Bearer JWT token, decodes the user email,
 * and fetches the latest user record directly from the unified MongoDB `user` collection.
 */
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized access: Missing or malformed token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is not defined");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usersCollection = await col("user");
    const user = await usersCollection.findOne({ email: decoded.email });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User account does not exist" });
    }

    // Attach verified user payload to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      image: user.image || "",
      role: user.role || "customer",
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
};

/**
 * Role-Based Access Control Middlewares
 */
const checkRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized: User not authenticated" });
  }

  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    message: "Forbidden access: Insufficient role permissions",
    requiredRoles: allowedRoles,
    currentRole: req.user.role,
  });
};

// Customer / Renter permission
export const verifyRenter = checkRole("customer", "renter");

// Equipment Owner permission
export const verifyOwner = checkRole("owner");

// Administrator permission
export const verifyAdmin = checkRole("admin");
