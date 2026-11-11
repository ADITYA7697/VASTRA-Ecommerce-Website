require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/Product");

const MAX_PRICE = 1500; // MRP cap
const PRICE_LIMIT = 999; // selling price must stay under ₹1000

function suggestedPrice(product) {
  const name = String(product.name || "").toLowerCase();
  const category = String(product.category || "").toLowerCase();
  if (/\b(t-?shirt|tee)\b/.test(name)) return 499;
  if (/shoe|sneaker/.test(name) || category === "shoes") return 999;
  if (/bag|backpack|tote|crossbody/.test(name) || category === "bags") {
    return /backpack|crossbody|mini/.test(name) ? 849 : 899;
  }
  if (name.includes("hoodie")) return 999;
  if (name.includes("shirt")) return 899;
  if (name.includes("sweatshirt")) return 999;
  if (/jean|denim|trouser/.test(name)) return 949;
  if (name.includes("jacket")) return 999;
  if (name.includes("sunglass")) return 799;
  if (name.includes("frame")) return 999;
  if (name.includes("belt")) return 599;
  if (name.includes("beanie")) return 499;
  return null;
}

async function main() {
  await connectDB();
  const products = await Product.find({});
  let updated = 0;
  for (const product of products) {
    let price = suggestedPrice(product);
    if (price === null) price = PRICE_LIMIT;
    if (product.price <= price) continue; // only ever lowers prices; keeps cheaper products as-is
    product.price = price;
    if (product.originalPrice != null) product.originalPrice = Math.min(MAX_PRICE, Math.max(price + 200, Math.round(price * 1.25 / 100) * 100 - 1));
    await product.save();
    updated++;
    console.log(`${product.name}: ₹${price}`);
  }
  console.log(`\nUpdated ${updated} existing products. No products were deleted or deactivated.`);
}
main().catch(err => { console.error("Price update failed:", err.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect().catch(() => {}); });
