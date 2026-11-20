import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

// All favorite actions require an authenticated user
router.use(verifyToken);

/**
 * GET /favorites
 * Retrieves all favorite equipment saved by the currently authenticated customer,
 * populated with real-time equipment details.
 */
router.get("/", async (req, res) => {
  try {
    const favoritesCol = await col("favorites");
    const userFavs = await favoritesCol.find({ userEmail: req.user.email }).toArray();

    if (userFavs.length === 0) {
      return res.json([]);
    }

    const equipmentIds = userFavs
      .map((f) => {
        try {
          return new ObjectId(f.equipmentId);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const equipmentCol = await col("equipment");
    const items = await equipmentCol.find({ _id: { $in: equipmentIds } }).toArray();

    // Attach favoritedAt timestamp
    const favMap = new Map(userFavs.map((f) => [f.equipmentId, f.createdAt]));
    const populated = items.map((item) => ({
      ...item,
      favoritedAt: favMap.get(item._id.toString()) || item.createdAt,
    }));

    res.json(populated);
  } catch (err) {
    console.error("Error fetching favorites:", err);
    res.status(500).json({ message: "Failed to retrieve favorites" });
  }
});

/**
 * POST /favorites
 * Adds an equipment item to the user's favorites
 */
router.post("/", async (req, res) => {
  try {
    const { equipmentId } = req.body;
    if (!equipmentId) {
      return res.status(400).json({ message: "equipmentId is required" });
    }

    const favoritesCol = await col("favorites");
    await favoritesCol.updateOne(
      { userEmail: req.user.email, equipmentId },
      {
        $setOnInsert: {
          userEmail: req.user.email,
          equipmentId,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ success: true, message: "Added to favorites" });
  } catch (err) {
    console.error("Error saving favorite:", err);
    res.status(500).json({ message: "Could not save to favorites" });
  }
});

/**
 * DELETE /favorites/:equipmentId
 * Removes an equipment item from the user's favorites
 */
router.delete("/:equipmentId", async (req, res) => {
  try {
    const favoritesCol = await col("favorites");
    const result = await favoritesCol.deleteOne({
      userEmail: req.user.email,
      equipmentId: req.params.equipmentId,
    });

    res.json({
      success: true,
      removed: result.deletedCount > 0,
      message: "Removed from favorites",
    });
  } catch (err) {
    console.error("Error removing favorite:", err);
    res.status(500).json({ message: "Could not remove from favorites" });
  }
});

/**
 * GET /favorites/check/:equipmentId
 * Checks whether a specific equipment item is favorited by the current user
 */
router.get("/check/:equipmentId", async (req, res) => {
  try {
    const favoritesCol = await col("favorites");
    const existing = await favoritesCol.findOne({
      userEmail: req.user.email,
      equipmentId: req.params.equipmentId,
    });

    res.json({ favorited: Boolean(existing) });
  } catch (err) {
    console.error("Error checking favorite status:", err);
    res.status(500).json({ message: "Could not check favorite status" });
  }
});

export default router;
