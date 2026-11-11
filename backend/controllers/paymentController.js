const crypto = require('crypto');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const PaymentIntent = require('../models/PaymentIntent');
const { validateCoupon } = require('./couponController');
const Coupon = require('../models/Coupon');

const configured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) && !/replace/i.test(`${process.env.RAZORPAY_KEY_ID}${process.env.RAZORPAY_KEY_SECRET}`);
const addressFrom = a => ({
  name: String(a.name || '').trim().slice(0, 80), phone: String(a.phone || '').trim().slice(0, 25),
  line1: String(a.line1 || '').trim().slice(0, 150), line2: String(a.line2 || '').trim().slice(0, 150),
  city: String(a.city || '').trim().slice(0, 80), state: String(a.state || '').trim().slice(0, 80),
  postalCode: String(a.postalCode || '').trim().slice(0, 12), country: String(a.country || 'India').trim().slice(0, 80)
});
const validateAddress = a => a && ['name','phone','line1','city','state','postalCode'].every(k => String(a[k] || '').trim()) && /^[0-9]{6}$/.test(String(a.postalCode).trim()) && /^[+0-9 ()-]{10,20}$/.test(String(a.phone).trim());
async function cartQuote(userId) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items.length) throw Object.assign(new Error('Cart is empty.'), { status: 400 });
  const items = []; let subtotal = 0;
  for (const line of cart.items) {
    const p = await Product.findOne({ _id: line.product, active: true });
    if (!p) throw Object.assign(new Error('A cart product is unavailable.'), { status: 409 });
    if (line.quantity > p.stock) throw Object.assign(new Error(`${p.name} has insufficient stock.`), { status: 409 });
    items.push({ product: p._id, name: p.name, image: p.image || (p.images && p.images[0]) || '', price: p.price, quantity: line.quantity, size: line.size || '' });
    subtotal += p.price * line.quantity;
  }
  const shippingFee = subtotal >= 999 ? 0 : 79;
  return { cart, items, subtotal, shippingFee, total: subtotal + shippingFee };
}
exports.publicKey = (_req, res) => {
  if (!configured() || !process.env.RAZORPAY_KEY_ID) return res.status(503).json({ success: false, message: 'Online payment is not configured. Use Cash on Delivery or configure Razorpay test/live keys.' });
  res.json({ success: true, keyId: process.env.RAZORPAY_KEY_ID, currency: 'INR' });
};
exports.createOrder = async (req, res) => {
  if (!configured()) return res.status(503).json({ success: false, message: 'Razorpay is not configured. Add Razorpay credentials to backend .env.' });
  const address = addressFrom(req.body.shippingAddress || {});
  if (!validateAddress(address)) return res.status(400).json({ success: false, message: 'Enter name, valid phone, complete address, city, state and 6-digit PIN code.' });
  const quote = await cartQuote(req.user._id);
  let couponCode = '', discount = 0;
  if (req.body.couponCode) { const applied = await validateCoupon(req.user, req.body.couponCode, quote.subtotal); couponCode = applied.coupon.code; discount = applied.discount; }
  quote.total = Math.max(0, quote.total - discount);
  const receipt = `v_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(quote.total * 100), currency: 'INR', receipt, notes: { userId: String(req.user._id) } }), signal: AbortSignal.timeout(10000)
  });
  const providerOrder = await response.json().catch(() => ({}));
  if (!response.ok || !providerOrder.id) return res.status(502).json({ success: false, message: 'Payment provider could not create an order. Please retry or use Cash on Delivery.' });
  await PaymentIntent.create({ user: req.user._id, razorpayOrderId: providerOrder.id, items: quote.items, shippingAddress: address, subtotal: quote.subtotal, shippingFee: quote.shippingFee, couponCode, discount, total: quote.total, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  res.status(201).json({ success: true, keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: providerOrder.id, amount: providerOrder.amount, currency: providerOrder.currency, quote: { subtotal: quote.subtotal, shippingFee: quote.shippingFee, total: quote.total } });
};
exports.verifyPayment = async (req, res) => {
  if (!configured()) return res.status(503).json({ success: false, message: 'Razorpay is not configured.' });
  const { razorpay_order_id: providerOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (![providerOrderId, paymentId, signature].every(v => typeof v === 'string' && v.length > 5)) return res.status(400).json({ success: false, message: 'Payment verification details are incomplete.' });
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${providerOrderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
  const existing = await Order.findOne({ razorpayPaymentId: paymentId });
  if (existing) {
    if (String(existing.user) !== String(req.user._id)) return res.status(409).json({ success: false, message: 'Payment already associated with another account.' });
    return res.json({ success: true, order: existing, message: 'Payment was already verified.' });
  }
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(10000) });
  const payment = await response.json().catch(() => ({}));
  if (!response.ok || payment.order_id !== providerOrderId || payment.status !== 'captured' || payment.currency !== 'INR') return res.status(400).json({ success: false, message: 'Payment is not captured or provider details do not match.' });
  const intent = await PaymentIntent.findOne({ razorpayOrderId: providerOrderId, user: req.user._id, status: 'created', expiresAt: { $gt: new Date() } });
  if (!intent) return res.status(409).json({ success: false, message: 'Payment session expired or does not belong to this account. If you were charged, contact support with your payment ID.' });
  if (Number(payment.amount) !== Math.round(intent.total * 100)) return res.status(400).json({ success: false, message: 'Captured amount does not match the payment order.' });
  const reserved = [];
  try {
    for (const item of intent.items) {
      const updated = await Product.findOneAndUpdate({ _id: item.product, active: true, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { new: true });
      if (!updated) throw Object.assign(new Error(`${item.name} is no longer available in the requested quantity.`), { status: 409 });
      reserved.push({ product: item.product, quantity: item.quantity });
    }
    const order = await Order.create({ user: req.user._id, items: intent.items, shippingAddress: intent.shippingAddress, subtotal: intent.subtotal, shippingFee: intent.shippingFee, couponCode: intent.couponCode, discount: intent.discount, total: intent.total, paymentMethod: 'razorpay', paymentStatus: 'paid', razorpayOrderId: providerOrderId, razorpayPaymentId: paymentId, status: 'confirmed' });
    intent.status = 'paid'; await intent.save();
    if (intent.couponCode) await Coupon.updateOne({code:intent.couponCode,active:true},{$inc:{uses:1}});
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) { const purchased = new Set(intent.items.map(i => `${String(i.product)}:${i.size || ''}`)); cart.items = cart.items.filter(i => !purchased.has(`${String(i.product)}:${i.size || ''}`)); await cart.save(); }
    return res.status(201).json({ success: true, order, message: 'Payment verified and order placed.' });
  } catch (err) {
    await Promise.all(reserved.map(item => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }).catch(() => null)));
    if (err.code === 11000) {
      const prior = await Order.findOne({ razorpayPaymentId: paymentId });
      if (prior && String(prior.user) === String(req.user._id)) return res.json({ success: true, order: prior, message: 'Payment was already verified.' });
    }
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    throw err;
  }
};
