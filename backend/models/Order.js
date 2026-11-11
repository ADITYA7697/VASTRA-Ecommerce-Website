const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true }, image: { type: String, default: "" },
    price: { type: Number, min: 0, required: true },
    quantity: { type: Number, min: 1, required: true }, size: { type: String, default: "" }
  }],
  shippingAddress: {
    name: { type: String, required: true }, phone: { type: String, required: true },
    line1: { type: String, required: true }, line2: { type: String, default: "" },
    city: { type: String, required: true }, state: { type: String, required: true },
    postalCode: { type: String, required: true }, country: { type: String, default: "India" }
  },
  subtotal: { type: Number, min: 0, required: true },
  shippingFee: { type: Number, min: 0, default: 0, required: true },
  couponCode: { type: String, default: "" },
  discount: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, required: true },
  paymentMethod: { type: String, enum: ["cod", "razorpay"], default: "cod" },
  razorpayOrderId: { type: String, default: "", index: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
  status: { type: String, enum: ["placed", "confirmed", "processing", "shipped", "delivered", "cancelled"], default: "placed" },
  deliveredAt: { type: Date, default: null },
  returnRequest: {
    requested: { type: Boolean, default: false },
    reason: { type: String, enum: ["wrong_item", "damaged_item", "size_issue", "not_as_described", "other"], default: undefined },
    note: { type: String, default: "", maxlength: 500 },
    status: { type: String, enum: ["none", "requested", "approved", "rejected", "completed"], default: "none" },
    requestedAt: { type: Date, default: null }
  }
}, { timestamps: true });
module.exports = mongoose.model("Order", schema);
