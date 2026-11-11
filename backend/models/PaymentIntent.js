const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  razorpayOrderId: { type: String, required: true, unique: true },
  items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, name: { type: String, required: true }, image: { type: String, default: '' }, price: { type: Number, required: true }, quantity: { type: Number, required: true }, size: { type: String, default: '' } }],
  shippingAddress: { name: String, phone: String, line1: String, line2: String, city: String, state: String, postalCode: String, country: String },
  subtotal: { type: Number, required: true }, shippingFee: { type: Number, required: true }, couponCode: { type: String, default: "" }, discount: { type: Number, default: 0 }, total: { type: Number, required: true },
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
  expiresAt: { type: Date, required: true, index: { expires: 86400 } }
}, { timestamps: true });
module.exports = mongoose.model('PaymentIntent', schema);
