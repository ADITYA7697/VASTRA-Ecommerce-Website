require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/Product");

// Replace these examples with your real products from js/products.js before seeding.
const products = [
  { name: "Classic Cotton T-Shirt", description: "Everyday cotton T-shirt.", price: 499, originalPrice: 699, category: "Men", image: "images/products/tshirt.jpg", stock: 25, featured: true, active: true },
  { name: "Everyday Kurti", description: "Comfortable everyday kurti.", price: 899, originalPrice: 1199, category: "Women", image: "images/products/kurti.jpg", stock: 20, featured: true, active: true }
];

async function main() {
  await connectDB();
  for (const p of products) await Product.findOneAndUpdate(
    { name: p.name, category: p.category }, { $set: p },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Seeded ${products.length} sample products. Replace examples with your actual catalog.`);
  await mongoose.disconnect();
}
main().catch(async e => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
