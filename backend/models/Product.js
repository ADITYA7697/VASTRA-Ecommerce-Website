const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, default: "" },
  price: { type: Number, required: true, min: 0, max: [999, "Price must be under ₹1000."] },
  originalPrice: { type: Number, min: 0, max: [1500, "MRP cannot be more than ₹1500."], default: null },
  category: { type: String, required: true, trim: true, index: true },
  image: { type: String, default: "" },
  images: [{ type: String }],
  brand: { type: String, default: "VASTRA" },
  sizes: [{ type: String }],
  colors: [{ type: String }],
  stock: { type: Number, default: 0, min: 0 },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true, index: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, name: { type: String, required: true }, rating: { type: Number, min: 1, max: 5, required: true }, title: { type: String, trim: true, maxlength: 100, default: "" }, comment: { type: String, trim: true, maxlength: 1200, required: true }, createdAt: { type: Date, default: Date.now } }]
}, { timestamps: true });
schema.index({ name: "text", description: "text", category: "text" });
module.exports = mongoose.model("Product", schema);
