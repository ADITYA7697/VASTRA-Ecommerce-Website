const list = () => (process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500").split(",").map(x => x.trim()).filter(Boolean);
module.exports = { list };
