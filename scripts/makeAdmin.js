import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

const email = process.argv[2];
if (!email) {
  console.log("Usage: node scripts/makeAdmin.js user@example.com");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "rentara_db";

if (!uri) {
  console.error("Error: MONGODB_URI is not defined in .env");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

try {
  await client.connect();
  const db = client.db(dbName);
  const result = await db.collection("user").updateOne(
    { email: email.toLowerCase().trim() },
    { $set: { role: "admin", updatedAt: new Date() } }
  );

  if (result.matchedCount > 0) {
    console.log(`Success: User '${email}' has been promoted to 'admin' role.`);
  } else {
    console.log(`User '${email}' not found. Ensure the user registers first via the client app.`);
  }
} catch (err) {
  console.error("Error updating user role:", err.message);
} finally {
  await client.close();
}
