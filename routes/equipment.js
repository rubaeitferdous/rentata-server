import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyOwner, verifyAdmin } from "../middleware/auth.js";

const router = Router();

const FIELDS = [
  "name",
  "description",
  "category",
  "location",
  "price",
  "rentalType",
  "availableQuantity",
  "condition",
  "brand",
  "model",
  "image",
  "terms",
];

const pick = (body) => {
  const out = {};
  for (const k of FIELDS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (out.price !== undefined) out.price = Number(out.price);
  if (out.availableQuantity !== undefined) {
    out.availableQuantity = Number(out.availableQuantity);
  }
  return out;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ==========================================================================
   PUBLIC EQUIPMENT ROUTES (Challenge 1: Server-Side Search, Filter & Sort)
   ========================================================================== */

/**
 * GET /equipment
 * Dynamic server-side search and filtering:
 * - Search by: Equipment Name, Location, or Category
 * - Filter by: Category, Rental Type, Price Range (min/max), Availability Status
 * - Sorting by: Price Low-to-High, Price High-to-Low, Recently Added
 * - Pagination: Page and Limit support
 */
router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      category,
      rentalType,
      minPrice,
      maxPrice,
      availability,
      sort = "newest",
      page = 1,
      limit = 9,
    } = req.query;

    const query = { status: "approved" };

    if (search && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      query.$or = [{ name: rx }, { location: rx }, { category: rx }, { brand: rx }];
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (rentalType && rentalType !== "All") {
      query.rentalType = rentalType;
    }

    const hasMinPrice = minPrice !== undefined && minPrice !== "" && !isNaN(Number(minPrice));
    const hasMaxPrice = maxPrice !== undefined && maxPrice !== "" && !isNaN(Number(maxPrice));

    if (hasMinPrice || hasMaxPrice) {
      query.price = {};
      if (hasMinPrice) {
        query.price.$gte = Number(minPrice);
      }
      if (hasMaxPrice) {
        query.price.$lte = Number(maxPrice);
      }
    }

    if (availability === "available") {
      query.availableQuantity = { $gt: 0 };
    } else if (availability === "unavailable") {
      query.availableQuantity = { $lte: 0 };
    }

    const sortMap = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      newest: { createdAt: -1 },
    };

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(30, Math.max(1, parseInt(limit, 10) || 9));
    const skip = (p - 1) * l;

    const equipmentCol = await col("equipment");

    const [equipment, total] = await Promise.all([
      equipmentCol
        .find(query)
        .sort(sortMap[sort] || sortMap.newest)
        .skip(skip)
        .limit(l)
        .toArray(),
      equipmentCol.countDocuments(query),
    ]);

    res.json({
      equipment,
      total,
      page: p,
      totalPages: Math.max(1, Math.ceil(total / l)),
    });
  } catch (err) {
    console.error("Error fetching equipment:", err);
    res.status(500).json({ message: "Failed to fetch equipment catalog" });
  }
});

/**
 * GET /equipment/featured
 * Displays 6 approved equipment items using MongoDB limit operator
 */
router.get("/featured", async (req, res) => {
  try {
    const equipmentCol = await col("equipment");
    const featuredItems = await equipmentCol
      .find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.json(featuredItems);
  } catch (err) {
    console.error("Error fetching featured equipment:", err);
    res.status(500).json({ message: "Failed to fetch featured equipment" });
  }
});

/**
 * GET /equipment/categories/stats
 * Aggregates approved equipment count for each category
 */
router.get("/categories/stats", async (req, res) => {
  try {
    const equipmentCol = await col("equipment");
    const stats = await equipmentCol
      .aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ])
      .toArray();

    const result = {};
    for (const s of stats) {
      if (s._id) result[s._id] = s.count;
    }

    res.json(result);
  } catch (err) {
    console.error("Error fetching category stats:", err);
    res.status(500).json({ message: "Failed to fetch category statistics" });
  }
});

/* ==========================================================================
   OWNER SPECIFIC ROUTES
   ========================================================================== */

/**
 * GET /equipment/mine
 * Retrieves all equipment items listed by the authenticated owner
 */
router.get("/mine", verifyToken, verifyOwner, async (req, res) => {
  try {
    const equipmentCol = await col("equipment");
    const items = await equipmentCol
      .find({ ownerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(items);
  } catch (err) {
    console.error("Error fetching owner equipment:", err);
    res.status(500).json({ message: "Failed to fetch your equipment" });
  }
});

/**
 * POST /equipment
 * Allows owners to add new equipment (defaults to status: "pending")
 */
router.post("/", verifyToken, verifyOwner, async (req, res) => {
  try {
    const data = pick(req.body);

    const REQUIRED_FIELDS = [
      "name",
      "description",
      "category",
      "location",
      "price",
      "rentalType",
      "availableQuantity",
      "image",
    ];

    for (const k of REQUIRED_FIELDS) {
      if (data[k] === undefined || data[k] === "") {
        return res.status(400).json({ message: `Field '${k}' is required` });
      }
    }

    if (isNaN(data.price) || data.price <= 0) {
      return res.status(400).json({ message: "Rental price must be a positive number" });
    }

    if (!Number.isInteger(data.availableQuantity) || data.availableQuantity < 0) {
      return res.status(400).json({ message: "Available quantity must be a non-negative integer" });
    }

    const doc = {
      ...data,
      condition: data.condition || "Excellent",
      brand: data.brand || "",
      model: data.model || "",
      terms: data.terms || "Standard equipment rental terms and deposit policies apply.",
      status: "pending",
      ownerId: req.user.id,
      ownerName: req.user.name,
      ownerEmail: req.user.email,
      ownerImage: req.user.image,
      createdAt: new Date(),
    };

    const equipmentCol = await col("equipment");
    const result = await equipmentCol.insertOne(doc);

    res.status(201).json({
      message: "Equipment submitted successfully and is pending administrative approval",
      insertedId: result.insertedId,
    });
  } catch (err) {
    console.error("Error creating equipment:", err);
    res.status(500).json({ message: "Failed to list equipment" });
  }
});

/* ==========================================================================
   ADMIN SPECIFIC ROUTES
   ========================================================================== */

/**
 * GET /equipment/admin/all
 * Lists all equipment items (pending, approved, rejected) for administrative moderation
 */
router.get("/admin/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const equipmentCol = await col("equipment");
    const items = await equipmentCol.find().sort({ createdAt: -1 }).toArray();
    res.json(items);
  } catch (err) {
    console.error("Error fetching admin equipment:", err);
    res.status(500).json({ message: "Failed to fetch equipment for admin" });
  }
});

/**
 * PATCH /equipment/:id/status
 * Moderation endpoint: Approve or Reject equipment listing
 */
router.patch("/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value. Must be pending, approved, or rejected" });
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid equipment ID format" });
    }

    const equipmentCol = await col("equipment");
    const updateRes = await equipmentCol.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, moderatedAt: new Date() } }
    );

    if (updateRes.matchedCount === 0) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.json({ success: true, message: `Equipment status updated to ${status}` });
  } catch (err) {
    console.error("Error updating equipment status:", err);
    res.status(500).json({ message: "Failed to update equipment status" });
  }
});

/* ==========================================================================
   SHARED DETAILED & MUTATION ROUTES (:id parameter)
   ========================================================================== */

/**
 * GET /equipment/:id
 * Equipment Details Page (Private Route)
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid equipment ID format" });
    }

    const equipmentCol = await col("equipment");
    const item = await equipmentCol.findOne({ _id: new ObjectId(req.params.id) });

    if (!item) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    // Only approved items or owner/admin can view details
    const canView =
      item.status === "approved" ||
      req.user.role === "admin" ||
      item.ownerEmail === req.user.email;

    if (!canView) {
      return res.status(403).json({ message: "Forbidden: This equipment is not currently approved for viewing" });
    }

    res.json(item);
  } catch (err) {
    console.error("Error fetching equipment details:", err);
    res.status(500).json({ message: "Failed to load equipment details" });
  }
});

/**
 * PATCH /equipment/:id
 * Update equipment listing (Owner can update their own; Admin can update any)
 */
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid equipment ID format" });
    }

    const equipmentCol = await col("equipment");
    const item = await equipmentCol.findOne({ _id: new ObjectId(req.params.id) });

    if (!item) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const isOwner = req.user.role === "owner" && item.ownerEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to edit this equipment" });
    }

    const update = pick(req.body);
    // If owner edits, set back to pending for administrative re-review
    if (isOwner && !isAdmin) {
      update.status = "pending";
    }

    await equipmentCol.updateOne(
      { _id: item._id },
      { $set: { ...update, updatedAt: new Date() } }
    );

    res.json({ success: true, message: "Equipment updated successfully" });
  } catch (err) {
    console.error("Error updating equipment:", err);
    res.status(500).json({ message: "Failed to update equipment" });
  }
});

/**
 * DELETE /equipment/:id
 * Delete equipment listing (Owner of the equipment or Admin)
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid equipment ID format" });
    }

    const equipmentCol = await col("equipment");
    const item = await equipmentCol.findOne({ _id: new ObjectId(req.params.id) });

    if (!item) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const isOwner = req.user.role === "owner" && item.ownerEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to delete this equipment" });
    }

    await equipmentCol.deleteOne({ _id: item._id });

    // Clean up associated favorites
    const favoritesCol = await col("favorites");
    await favoritesCol.deleteMany({ equipmentId: req.params.id });

    res.json({ success: true, message: "Equipment deleted successfully" });
  } catch (err) {
    console.error("Error deleting equipment:", err);
    res.status(500).json({ message: "Failed to delete equipment" });
  }
});

export default router;
