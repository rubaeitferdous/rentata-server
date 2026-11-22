import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

const email = process.argv[2];
const role = process.argv[3];

if (!email || !role) {
  console.log("Usage: node scripts/setRole.js user@example.com role");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

await client.connect();
const db = client.db(process.env.DB_NAME || "rentara_db");
const result = await db.collection("user").updateOne(
  { email: email.toLowerCase().trim() },
  { $set: { role: role.toLowerCase().trim(), updatedAt: new Date() } }
);

console.log(`Updated ${email} to role ${role}. Matched: ${result.matchedCount}`);
await client.close();
