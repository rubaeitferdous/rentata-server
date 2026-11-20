import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = Router();

// All user management routes require valid authentication
router.use(verifyToken);

/**
 * Helper to build an ID query that matches both string ID and ObjectId
 */
const buildIdQuery = (id) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] };
  }
  return { $or: [{ _id: id }, { id: id }] };
};

/**
 * GET /users/me
 * Retrieves current user's profile details
 */
router.get("/me", async (req, res) => {
  try {
    const usersCol = await col("user");
    const user = await usersCol.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ message: "Failed to retrieve user profile" });
  }
});

/**
 * PATCH /users/profile
 * Profile Page: Allows currently logged-in user to update their personal details
 * (name, profile image, phone number, and address)
 */
router.patch("/profile", async (req, res) => {
  try {
    const { name, image, phone, address } = req.body;
    const updateFields = {};

    if (name !== undefined && name.trim()) updateFields.name = name.trim();
    if (image !== undefined && image.trim()) updateFields.image = image.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (address !== undefined) updateFields.address = address.trim();

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No valid profile fields provided for update" });
    }

    updateFields.updatedAt = new Date();

    const usersCol = await col("user");
    await usersCol.updateOne(
      { email: req.user.email },
      { $set: updateFields }
    );

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ message: "Failed to update profile information" });
  }
});

/* ==========================================================================
   ADMINISTRATOR USER MANAGEMENT ENDPOINTS
   ========================================================================== */

/**
 * GET /users
 * Admin Dashboard: Retrieves all registered users in the platform
 */
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const usersCol = await col("user");
    const usersList = await usersCol
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(usersList);
  } catch (err) {
    console.error("Error retrieving user accounts for admin:", err);
    res.status(500).json({ message: "Failed to retrieve registered users" });
  }
});

/**
 * PATCH /users/:id/role
 * Admin Dashboard: Changes role of an account (Customer, Owner, Admin)
 */
router.patch("/:id/role", verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["customer", "owner", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Role must be customer, owner, or admin" });
    }

    const idQuery = buildIdQuery(req.params.id);
    const usersCol = await col("user");

    const result = await usersCol.updateOne(idQuery, {
      $set: { role, roleUpdatedAt: new Date() },
    });

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Target user not found" });
    }

    res.json({ success: true, message: `User role successfully updated to ${role}` });
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).json({ message: "Failed to change user role" });
  }
});

/**
 * DELETE /users/:id
 * Admin Dashboard: Deletes a user account (prevents deleting oneself)
 */
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const idQuery = buildIdQuery(req.params.id);
    const usersCol = await col("user");

    const targetUser = await usersCol.findOne(idQuery);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.email === req.user.email) {
      return res.status(400).json({ message: "You cannot delete your own administrative account" });
    }

    await usersCol.deleteOne(idQuery);

    res.json({ success: true, message: "User account deleted successfully" });
  } catch (err) {
    console.error("Error deleting user account:", err);
    res.status(500).json({ message: "Failed to delete user account" });
  }
});

export default router;
