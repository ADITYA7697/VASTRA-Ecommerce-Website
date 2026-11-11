const mongoose = require("mongoose");
const Product = require("../models/Product");
const escape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.list = async (req, res) => {
  const { q, category, sort = "newest", featured, page = 1, limit = 24 } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1), n = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
  const filter = { active: true };
  if (category && category !== "all") filter.category = new RegExp("^" + escape(String(category)) + "$", "i");
  if (featured === "true") filter.featured = true;
  if (q && String(q).trim()) {
    const term = escape(String(q).trim());
    filter.$or = [{ name: new RegExp(term, "i") }, { description: new RegExp(term, "i") }, { category: new RegExp(term, "i") }];
  }
  const sorts = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, name: { name: 1 } };
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sorts[sort] || sorts.newest).skip((p - 1) * n).limit(n),
    Product.countDocuments(filter)
  ]);
  res.json({ success: true, products, pagination: { page: p, limit: n, total, pages: Math.ceil(total / n) } });
};
exports.featured = async (_req, res) => res.json({ success: true, products: await Product.find({ active: true, featured: true }).limit(12) });
exports.getOne = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product ID." });
  const product = await Product.findOne({ _id: req.params.id, active: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found." });
  res.json({ success: true, product });
};
exports.adminList = async (_req, res) => res.json({ success: true, products: await Product.find().sort({ createdAt: -1 }) });
exports.create = async (req, res) => res.status(201).json({ success: true, product: await Product.create(clean(req.body)) });
exports.update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product ID." });
  const product = await Product.findByIdAndUpdate(req.params.id, clean(req.body), { new: true, runValidators: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found." });
  res.json({ success: true, product });
};
exports.remove = async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found." });
  res.json({ success: true, message: "Product deactivated." });
};
function clean(b) {
  const o = {};
  for (const k of ["name","description","price","originalPrice","category","image","images","brand","sizes","colors","stock","featured","active","rating"]) if (b[k] !== undefined) o[k] = b[k];
  if (o.price !== undefined) o.price = Number(o.price);
  if (o.stock !== undefined) o.stock = Number(o.stock);
  if (o.originalPrice !== undefined && o.originalPrice !== null && o.originalPrice !== "") o.originalPrice = Number(o.originalPrice);
  return o;
}

exports.reviews = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success:false, message:"Invalid product ID." });
  const product = await Product.findOne({ _id:req.params.id, active:true }).select("reviews rating");
  if (!product) return res.status(404).json({ success:false, message:"Product not found." });
  res.json({ success:true, reviews: product.reviews.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)), rating:product.rating });
};
exports.addReview = async (req, res) => {
  const rating = Number(req.body.rating), comment = String(req.body.comment||"").trim(), title = String(req.body.title||"").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 5) return res.status(400).json({success:false,message:"Choose a 1–5 star rating and write at least 5 characters."});
  const product = await Product.findOne({_id:req.params.id,active:true});
  if (!product) return res.status(404).json({success:false,message:"Product not found."});
  if (product.reviews.some(r=>String(r.user)===String(req.user._id))) return res.status(409).json({success:false,message:"You have already reviewed this product."});
  product.reviews.push({user:req.user._id,name:req.user.name,rating,title,comment});
  product.rating = product.reviews.reduce((sum,r)=>sum+r.rating,0)/product.reviews.length;
  await product.save(); res.status(201).json({success:true,message:"Review published.",rating:product.rating,reviews:product.reviews});
};
