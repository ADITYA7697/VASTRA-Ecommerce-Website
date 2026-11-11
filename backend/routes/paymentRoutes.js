const r = require("express").Router();
const c = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
const wrap = require("../utils/asyncHandler");
r.get("/config", wrap(c.publicKey));
r.post("/razorpay/order", protect, wrap(c.createOrder));
r.post("/razorpay/verify", protect, wrap(c.verifyPayment));
module.exports = r;
