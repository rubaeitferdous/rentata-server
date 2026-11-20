import { MongoClient, ServerApiVersion } from "mongodb";

let client;
let db;

export async function getDB() {
  if (db) return db;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is missing.");
  }

  client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true,
    },
  });

  await client.connect();
  const dbName = process.env.DB_NAME || "rentara_db";
  db = client.db(dbName);

  // Setup unique and performance indexes
  try {
    // Prevents duplicate bookings for the same Stripe checkout session
    await db.collection("bookings").createIndex({ sessionId: 1 }, { unique: true, sparse: true });
    
    // Prevents duplicate favorites per user-equipment pair
    await db.collection("favorites").createIndex({ userEmail: 1, equipmentId: 1 }, { unique: true });
    
    // Performance indexes for equipment queries
    await db.collection("equipment").createIndex({ status: 1, category: 1, price: 1 });
    await db.collection("equipment").createIndex({ ownerEmail: 1 });
  } catch (err) {
    console.warn("Index initialization notice:", err.message);
  }

  return db;
}

export const col = async (name) => (await getDB()).collection(name);
