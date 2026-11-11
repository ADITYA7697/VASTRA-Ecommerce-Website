const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { validateCoupon } = require("./couponController");

exports.create = async (req, res) => {
  const { shippingAddress, paymentMethod = "cod" } = req.body;
  if (paymentMethod !== "cod") return res.status(400).json({ success: false, message: "Only Cash on Delivery is configured." });
  const required = ["name","phone","line1","city","state","postalCode"];
  if (!shippingAddress || required.some(k => !String(shippingAddress[k] || "").trim())) return res.status(400).json({ success: false, message: "Complete shipping address is required." });
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || !cart.items.length) return res.status(400).json({ success: false, message: "Cart is empty." });

  const items = []; let subtotal = 0;
  for (const item of cart.items) {
    const p = await Product.findOne({ _id: item.product, active: true });
    if (!p) return res.status(400).json({ success: false, message: "A cart product is unavailable." });
    if (item.quantity > p.stock) return res.status(400).json({ success: false, message: `${p.name} has insufficient stock.` });
    items.push({ product: p._id, name: p.name, image: p.image || (p.images && p.images[0]) || "", price: p.price, quantity: item.quantity, size: item.size || "" });
    subtotal += p.price * item.quantity;
  }
  const shippingFee = subtotal >= 999 ? 0 : 79;
  let couponCode = "", discount = 0;
  if (req.body.couponCode) { const applied = await validateCoupon(req.user, req.body.couponCode, subtotal); couponCode = applied.coupon.code; discount = applied.discount; }
  // Reserve stock atomically so concurrent checkouts cannot oversell the same units.
  const reserved = [];
  let order;
  try {
    for (const item of items) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, active: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) throw new Error(`${item.name} is no longer available in the requested quantity.`);
      reserved.push({ product: item.product, quantity: item.quantity });
    }
    order = await Order.create({
      user: req.user._id, items,
      shippingAddress: {
        name: String(shippingAddress.name).trim(), phone: String(shippingAddress.phone).trim(),
        line1: String(shippingAddress.line1).trim(), line2: String(shippingAddress.line2 || "").trim(),
        city: String(shippingAddress.city).trim(), state: String(shippingAddress.state).trim(),
        postalCode: String(shippingAddress.postalCode).trim(), country: String(shippingAddress.country || "India").trim()
      },
      subtotal, shippingFee, couponCode, discount, total: Math.max(0, subtotal + shippingFee - discount), paymentMethod: "cod"
    });
  } catch (err) {
    await Promise.all(reserved.map(item =>
      Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }).catch(() => null)
    ));
    if (err.message && err.message.includes("no longer available")) {
      return res.status(409).json({ success: false, message: err.message });
    }
    throw err;
  }
  if (couponCode) { const Coupon = require("../models/Coupon"); await Coupon.updateOne({code:couponCode, active:true}, {$inc:{uses:1}}); }
  cart.items = []; await cart.save();
  res.status(201).json({ success: true, message: "COD order placed.", order });
};
exports.mine = async (req, res) => res.json({ success: true, orders: await Order.find({ user: req.user._id }).sort({ createdAt: -1 }) });
exports.getOne = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order ID." });
  const filter = { _id: req.params.id }; if (req.user.role !== "admin") filter.user = req.user._id;
  const order = await Order.findOne(filter);
  if (!order) return res.status(404).json({ success: false, message: "Order not found." });
  res.json({ success: true, order });
};
exports.requestReturn = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order ID." });
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: "Order not found." });
  if (order.status !== "delivered") return res.status(400).json({ success: false, message: "Returns can only be requested for delivered orders." });
  if (order.returnRequest?.requested || !["none", undefined, null].includes(order.returnRequest?.status)) return res.status(409).json({ success: false, message: "A return request already exists for this order." });
  const deliveredAt = order.deliveredAt || order.updatedAt || order.createdAt;
  const daysSinceDelivery = (Date.now() - new Date(deliveredAt).getTime()) / 86400000;
  if (daysSinceDelivery > 7 || daysSinceDelivery < 0) return res.status(400).json({ success: false, message: "The 7-day return window has ended." });
  const allowedReasons = ["wrong_item", "damaged_item", "size_issue", "not_as_described", "other"];
  const reason = String(req.body.reason || "");
  if (!allowedReasons.includes(reason)) return res.status(400).json({ success: false, message: "Please select a valid return reason." });
  order.returnRequest = { requested: true, reason, note: String(req.body.note || "").trim().slice(0, 500), status: "requested", requestedAt: new Date() };
  await order.save();
  res.status(201).json({ success: true, message: "Return request submitted. Our team will review it.", order });
};
exports.reviewReturn = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order ID." });
  const next = String(req.body.status || "");
  if (!["approved", "rejected", "completed"].includes(next)) return res.status(400).json({ success: false, message: "Status must be approved, rejected or completed." });
  const order = await Order.findById(req.params.id);
  if (!order || !order.returnRequest?.requested) return res.status(404).json({ success: false, message: "Return request not found." });
  const current = order.returnRequest.status || "requested";
  const allowed = { requested: ["approved", "rejected"], approved: ["completed"] };
  if (!(allowed[current] || []).includes(next)) return res.status(400).json({ success: false, message: `A return that is "${current}" cannot be changed to "${next}".` });
  order.returnRequest.status = next;
  if (next === "completed") await Promise.all((order.items || []).map(i => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } }).catch(() => null)));   // returned items go back on the shelf
  await order.save();
  res.json({ success: true, order });
};
exports.adminList = async (_req, res) => res.json({ success: true, orders: await Order.find().populate("user", "name email phone").sort({ createdAt: -1 }).limit(200) });
exports.updateStatus = async (req, res) => {
  const allowed = ["confirmed","processing","shipped","delivered","cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ success: false, message: "Invalid status." });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found." });
  if (["delivered","cancelled"].includes(order.status)) return res.status(400).json({ success: false, message: "Finalized order status cannot be changed." });
  order.status = req.body.status; if (req.body.status === "delivered" && !order.deliveredAt) order.deliveredAt = new Date(); await order.save(); res.json({ success: true, order });
};
