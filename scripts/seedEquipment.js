import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

/**
 * Seeding script for sample verified equipment data.
 * Usage: node scripts/seedEquipment.js [optional_owner_email]
 */
const targetOwnerEmail = process.argv[2];

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
  const usersCol = db.collection("user");
  const equipmentCol = db.collection("equipment");

  let owner = null;
  if (targetOwnerEmail) {
    owner = await usersCol.findOne({ email: targetOwnerEmail });
  }

  if (!owner) {
    owner = await usersCol.findOne({ role: "owner" }) || await usersCol.findOne();
  }

  const ownerId = owner ? owner._id.toString() : "seed_owner_101";
  const ownerName = owner ? owner.name : "Rentara Premier Equipment";
  const ownerEmail = owner ? owner.email : "owner@rentara.com";
  const ownerImage = owner?.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200";

  const sampleEquipment = [
    {
      name: "CAT 320 Hydraulic Excavator",
      category: "Construction Equipment",
      location: "Gulshan, Dhaka",
      price: 320,
      rentalType: "Daily",
      brand: "Caterpillar",
      model: "320D3",
      availableQuantity: 4,
      condition: "Excellent",
      image: "https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?w=800&q=80",
      description: "Heavy-duty hydraulic excavator designed for bulk earthmoving, foundation digging, and high-efficiency commercial civil construction.",
      terms: "Security deposit required upon delivery. Trained operator available upon request. Routine service covered by owner.",
      status: "approved",
    },
    {
      name: "Sony FX6 Cinema Line Camera Kit",
      category: "Photography Equipment",
      location: "Dhanmondi, Dhaka",
      price: 180,
      rentalType: "Daily",
      brand: "Sony",
      model: "ILME-FX6V",
      availableQuantity: 2,
      condition: "Like New",
      image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
      description: "Full-frame 4K cinema kit including 24-70mm G-Master II lens, V-mount batteries, monitor cage, and high-speed CFexpress cards.",
      terms: "Valid National ID or passport required. Equipment must be inspected before dispatch and returned clean.",
      status: "approved",
    },
    {
      name: "Toyota Hiace Commercial High-Roof",
      category: "Vehicles & Transportation",
      location: "Agrabad, Chattogram",
      price: 95,
      rentalType: "Daily",
      brand: "Toyota",
      model: "HiAce GL",
      availableQuantity: 5,
      condition: "Excellent",
      image: "https://images.unsplash.com/photo-1559297434-fae8a1916a79?w=800&q=80",
      description: "Spacious 14-seater or cargo transporter with dual air-conditioning, GPS tracking, and automatic sliding door.",
      terms: "Valid commercial driving license required. Fuel at renter's expense. Toll fees not included.",
      status: "approved",
    },
    {
      name: "Mahindra 575 DI Heavy Farm Tractor",
      category: "Agriculture Equipment",
      location: "Sherpur, Bogura",
      price: 450,
      rentalType: "Weekly",
      brand: "Mahindra",
      model: "575 DI Bhoomiputra",
      availableQuantity: 3,
      condition: "Good",
      image: "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=800&q=80",
      description: "45 HP multi-utility agricultural tractor featuring advanced hydraulics, rotary tiller attachments, and high fuel efficiency.",
      terms: "Security agreement required. Attachment maintenance instructions must be strictly followed.",
      status: "approved",
    },
    {
      name: "Yamaha STAGEPAS 1K Pro Sound System",
      category: "Event Equipment",
      location: "Zindabazar, Sylhet",
      price: 130,
      rentalType: "Daily",
      brand: "Yamaha",
      model: "STAGEPAS 1K MkII",
      availableQuantity: 3,
      condition: "Excellent",
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80",
      description: "1000W portable column PA system with 5-channel digital mixer, bluetooth audio streaming, and wireless microphone setup.",
      terms: "Rain-protected venue required for outdoor setups. Renter is liable for speaker driver overload.",
      status: "approved",
    },
    {
      name: "RED V-Raptor 8K VV Cinema Package",
      category: "Photography Equipment",
      location: "Banani, Dhaka",
      price: 480,
      rentalType: "Daily",
      brand: "RED Digital Cinema",
      model: "V-Raptor 8K",
      availableQuantity: 1,
      condition: "Like New",
      image: "https://images.unsplash.com/photo-1589872766859-ac52dfb755e1?w=800&q=80",
      description: "Industry-leading multi-format 8K sensor camera package with electronic ND filters, RED PRO CFexpress cards, and anamorphic lens support.",
      terms: "Production insurance and certificate required. Certified focus puller/DIT required on set.",
      status: "approved",
    },
    {
      name: "ASUS ROG Zephyrus G16 (RTX 4090)",
      category: "Electronics",
      location: "Mirpur, Dhaka",
      price: 650,
      rentalType: "Monthly",
      brand: "ASUS",
      model: "ROG Zephyrus G16",
      availableQuantity: 6,
      condition: "Like New",
      image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80",
      description: "High-performance editing & 3D rendering mobile workstation with Intel Core Ultra 9, RTX 4090 16GB, and 64GB DDR5 RAM.",
      terms: "Corporate contract or institutional deposit required for monthly rental terms.",
      status: "approved",
    },
    {
      name: "DJI Inspire 3 Aerial Cinema Drone",
      category: "Photography Equipment",
      location: "Uttara, Dhaka",
      price: 350,
      rentalType: "Daily",
      brand: "DJI",
      model: "Inspire 3",
      availableQuantity: 2,
      condition: "Excellent",
      image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=80",
      description: "Full-frame 8K ProRes RAW cinema drone with dual-operator RC Plus remote controls and high-precision RTK positioning.",
      terms: "FAA / CAAB certified commercial drone pilot license required before dispatch.",
      status: "approved",
    },
  ];

  const docs = sampleEquipment.map((item, index) => ({
    ...item,
    ownerId,
    ownerName,
    ownerEmail,
    ownerImage,
    createdAt: new Date(Date.now() - index * 3600000 * 24),
  }));

  const result = await equipmentCol.insertMany(docs);
  console.log(`Successfully seeded ${result.insertedCount} high-quality equipment items into MongoDB!`);
} catch (err) {
  console.error("Error seeding equipment:", err.message);
} finally {
  await client.close();
}
