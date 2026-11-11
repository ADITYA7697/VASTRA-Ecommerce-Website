const Cart = require("../models/Cart");
const Product = require("../models/Product");
async function cartFor(user) {
  let cart = await Cart.findOne({ user });
  if (!cart) cart = await Cart.create({ user, items: [] });
  return cart;
}
exports.get = async (req, res) => {
  const cart = await cartFor(req.user._id); await cart.populate("items.product");
  res.json({ success: true, cart });
};
exports.add = async (req, res) => {
  const { productId, quantity = 1, size = "" } = req.body;
  const qty = Number(quantity);
  if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 20) return res.status(400).json({ success: false, message: "Valid productId and quantity (1-20) required." });
  const product = await Product.findOne({ _id: productId, active: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found." });
  if (qty > product.stock) return res.status(400).json({ success: false, message: "Not enough stock." });
  const chosenSize = String(size || "").trim();
  if ((product.sizes || []).length && !product.sizes.includes(chosenSize)) return res.status(400).json({ success: false, message: "Please select a valid size for this product." });
  const cart = await cartFor(req.user._id);
  const existing = cart.items.find(i => i.product.toString() === productId && i.size === chosenSize);
  if (existing) {
    if (existing.quantity + qty > product.stock) return res.status(400).json({ success: false, message: "Quantity exceeds stock." });
    existing.quantity += qty;
  } else cart.items.push({ product: product._id, quantity: qty, size: chosenSize.slice(0, 30) });
  await cart.save(); await cart.populate("items.product");
  res.json({ success: true, cart });
};
exports.update = async (req, res) => {
  const qty = Number(req.body.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) return res.status(400).json({ success: false, message: "Quantity must be 1-20." });
  const cart = await cartFor(req.user._id), item = cart.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ success: false, message: "Cart item not found." });
  const p = await Product.findById(item.product);
  if (!p || qty > p.stock) return res.status(400).json({ success: false, message: "Quantity unavailable." });
  item.quantity = qty; await cart.save(); await cart.populate("items.product");
  res.json({ success: true, cart });
};
exports.remove = async (req, res) => {
  const cart = await cartFor(req.user._id), item = cart.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ success: false, message: "Cart item not found." });
  item.deleteOne(); await cart.save(); await cart.populate("items.product");
  res.json({ success: true, cart });
};
exports.clear = async (req, res) => {
  const cart = await cartFor(req.user._id); cart.items = []; await cart.save();
  res.json({ success: true, cart });
};
