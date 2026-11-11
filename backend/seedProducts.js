require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/Product");
const products = [
  {
    "name": "Essential Cotton T-Shirt",
    "price": 399,
    "category": "clothing",
    "image": "assets/product-tshirt.jpg",
    "images": [
      "assets/product-tshirt.jpg"
    ],
    "description": "A soft everyday tee with a clean, versatile fit.",
    "originalPrice": 599,
    "featured": true,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "White",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Relaxed Premium Hoodie",
    "price": 799,
    "category": "clothing",
    "image": "assets/product-hoodie.jpg",
    "images": [
      "assets/product-hoodie.jpg"
    ],
    "description": "A relaxed layer with a modern streetwear silhouette.",
    "originalPrice": 1099,
    "featured": true,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Grey"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Straight Fit Denim Jeans",
    "price": 799,
    "category": "clothing",
    "image": "assets/product-jeans.jpg",
    "images": [
      "assets/product-jeans.jpg"
    ],
    "description": "Timeless denim with an easy straight-leg fit.",
    "originalPrice": 1099,
    "featured": true,
    "stock": 60,
    "sizes": [
      "28",
      "30",
      "32",
      "34",
      "36"
    ],
    "colors": [
      "Blue"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Oxford Casual Shirt",
    "price": 699,
    "category": "clothing",
    "image": "assets/product-shirt.jpg",
    "images": [
      "assets/product-shirt.jpg"
    ],
    "description": "A polished everyday shirt for workdays and weekends.",
    "originalPrice": 999,
    "featured": true,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Blue",
      "White"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Minimal Utility Jacket",
    "price": 849,
    "category": "clothing",
    "image": "assets/product-bomber.jpg",
    "images": [
      "assets/product-bomber.jpg"
    ],
    "description": "A versatile outer layer with clean lines and useful pockets.",
    "originalPrice": 1199,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Olive",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Everyday Crewneck Sweatshirt",
    "price": 699,
    "category": "clothing",
    "image": "assets/product-sweatshirt.jpg",
    "images": [
      "assets/product-sweatshirt.jpg"
    ],
    "description": "A comfortable crewneck made for effortless layering.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Cream",
      "Charcoal"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Linen Blend Summer Shirt",
    "price": 649,
    "category": "clothing",
    "image": "assets/product-linen-shirt.jpg",
    "images": [
      "assets/product-linen-shirt.jpg"
    ],
    "description": "Breathable, relaxed styling for warm-weather days.",
    "originalPrice": 899,
    "featured": true,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Beige",
      "White"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Wide-Leg Casual Trousers",
    "price": 749,
    "category": "clothing",
    "image": "assets/product-trousers.jpg",
    "images": [
      "assets/product-trousers.jpg"
    ],
    "description": "Modern wide-leg trousers with an easy drape.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "28",
      "30",
      "32",
      "34"
    ],
    "colors": [
      "Black",
      "Stone"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Classic White Sneakers",
    "price": 799,
    "category": "shoes",
    "image": "assets/product-white-sneakers.jpg",
    "images": [
      "assets/product-white-sneakers.jpg"
    ],
    "description": "A clean sneaker profile designed for everyday outfits.",
    "originalPrice": 1099,
    "featured": true,
    "stock": 60,
    "sizes": [
      "6",
      "7",
      "8",
      "9",
      "10"
    ],
    "colors": [
      "White",
      "Red"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Retro Street Sneakers",
    "price": 799,
    "category": "shoes",
    "image": "assets/product-retro-sneakers.jpg",
    "images": [
      "assets/product-retro-sneakers.jpg"
    ],
    "description": "Retro-inspired trainers with a sporty finish.",
    "originalPrice": 1099,
    "featured": true,
    "stock": 60,
    "sizes": [
      "6",
      "7",
      "8",
      "9",
      "10"
    ],
    "colors": [
      "White",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Structured Everyday Backpack",
    "price": 649,
    "category": "bags",
    "image": "assets/product-backpack.jpg",
    "images": [
      "assets/product-backpack.jpg"
    ],
    "description": "A streamlined backpack for daily essentials.",
    "originalPrice": 899,
    "featured": true,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Olive"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Minimal Crossbody Bag",
    "price": 599,
    "category": "bags",
    "image": "assets/product-crossbody.jpg",
    "images": [
      "assets/product-crossbody.jpg"
    ],
    "description": "A compact crossbody bag for hands-free everyday carry.",
    "originalPrice": 799,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Tan"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Modern Black Sunglasses",
    "price": 499,
    "category": "eyewear",
    "image": "assets/product-sunglasses.jpg",
    "images": [
      "assets/product-sunglasses.jpg"
    ],
    "description": "A timeless frame that adds a sharp finishing touch.",
    "originalPrice": 699,
    "featured": true,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Everyday Optical Frames",
    "price": 599,
    "category": "eyewear",
    "image": "assets/product-glasses.jpg",
    "images": [
      "assets/product-glasses.jpg"
    ],
    "description": "Lightweight, understated frames for a clean look.",
    "originalPrice": 799,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Tortoise"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Classic Leather-Look Belt",
    "price": 399,
    "category": "accessories",
    "image": "assets/product-belt.jpg",
    "images": [
      "assets/product-belt.jpg"
    ],
    "description": "A versatile finishing detail for smart-casual outfits.",
    "originalPrice": 599,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Brown"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Ribbed Knit Beanie",
    "price": 299,
    "category": "accessories",
    "image": "assets/product-hoodie.jpg",
    "images": [
      "assets/product-hoodie.jpg"
    ],
    "description": "A soft ribbed beanie for cool days and relaxed fits.",
    "originalPrice": 399,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Grey"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Minimal Everyday Tote",
    "price": 499,
    "category": "bags",
    "image": "assets/product-tote.jpg",
    "images": [
      "assets/product-tote.jpg"
    ],
    "description": "A reusable carryall with a simple, roomy silhouette.",
    "originalPrice": 699,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Natural",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Lightweight Bomber Jacket",
    "price": 849,
    "category": "clothing",
    "image": "assets/product-bomber.jpg",
    "images": [
      "assets/product-bomber.jpg"
    ],
    "description": "An easy-to-style jacket for transitional weather.",
    "originalPrice": 1199,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Olive"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Basic Round Neck Tee",
    "price": 249,
    "category": "clothing",
    "image": "assets/product-tshirt.jpg",
    "images": [
      "assets/product-tshirt.jpg"
    ],
    "description": "A light, breathable round-neck tee for everyday wear.",
    "originalPrice": 399,
    "featured": true,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "White",
      "Black",
      "Navy"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Printed Graphic T-Shirt",
    "price": 299,
    "category": "clothing",
    "image": "assets/product-tshirt.jpg",
    "images": [
      "assets/product-tshirt.jpg"
    ],
    "description": "A soft cotton T-shirt with a simple street-style look.",
    "originalPrice": 399,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "White",
      "Grey"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Cotton Casual Shirt",
    "price": 499,
    "category": "clothing",
    "image": "assets/product-shirt.jpg",
    "images": [
      "assets/product-shirt.jpg"
    ],
    "description": "A easy-care cotton shirt for college, office or outings.",
    "originalPrice": 699,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Blue",
      "White"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Lightweight Zip Hoodie",
    "price": 599,
    "category": "clothing",
    "image": "assets/product-hoodie.jpg",
    "images": [
      "assets/product-hoodie.jpg"
    ],
    "description": "A light zip-up hoodie for cool evenings and travel.",
    "originalPrice": 799,
    "featured": true,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Grey"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Slim Fit Denim Jeans",
    "price": 699,
    "category": "clothing",
    "image": "assets/product-jeans.jpg",
    "images": [
      "assets/product-jeans.jpg"
    ],
    "description": "Comfortable stretch denim with a clean slim fit.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "28",
      "30",
      "32",
      "34"
    ],
    "colors": [
      "Blue",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Casual Jogger Trousers",
    "price": 499,
    "category": "clothing",
    "image": "assets/product-trousers.jpg",
    "images": [
      "assets/product-trousers.jpg"
    ],
    "description": "Relaxed jogger-style trousers made for all-day comfort.",
    "originalPrice": 699,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Olive"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Everyday Canvas Sneakers",
    "price": 649,
    "category": "shoes",
    "image": "assets/product-white-sneakers.jpg",
    "images": [
      "assets/product-white-sneakers.jpg"
    ],
    "description": "Light canvas sneakers that go with almost everything.",
    "originalPrice": 899,
    "featured": true,
    "stock": 60,
    "sizes": [
      "6",
      "7",
      "8",
      "9",
      "10"
    ],
    "colors": [
      "White"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Mini Sling Crossbody Bag",
    "price": 349,
    "category": "bags",
    "image": "assets/product-crossbody.jpg",
    "images": [
      "assets/product-crossbody.jpg"
    ],
    "description": "A compact sling bag for phone, wallet and daily essentials.",
    "originalPrice": 499,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Tan"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Daily Canvas Tote",
    "price": 299,
    "category": "bags",
    "image": "assets/product-tote.jpg",
    "images": [
      "assets/product-tote.jpg"
    ],
    "description": "A roomy canvas tote for shopping, college or work.",
    "originalPrice": 399,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Beige",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Round Frame Sunglasses",
    "price": 349,
    "category": "eyewear",
    "image": "assets/product-sunglasses.jpg",
    "images": [
      "assets/product-sunglasses.jpg"
    ],
    "description": "Lightweight UV-protection sunglasses with a classic round frame.",
    "originalPrice": 499,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Everyday Reversible Belt",
    "price": 299,
    "category": "accessories",
    "image": "assets/product-belt.jpg",
    "images": [
      "assets/product-belt.jpg"
    ],
    "description": "A reversible black/brown belt with a polished buckle.",
    "originalPrice": 399,
    "featured": false,
    "stock": 60,
    "sizes": [
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Brown"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Classic Cotton Polo T-Shirt",
    "price": 449,
    "category": "clothing",
    "image": "assets/product-tshirt.jpg",
    "images": [
      "assets/product-tshirt.jpg"
    ],
    "description": "A smart polo tee in breathable cotton for work and weekends.",
    "originalPrice": 599,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Navy",
      "White"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.4
  },
  {
    "name": "Slim Chino Trousers",
    "price": 699,
    "category": "clothing",
    "image": "assets/product-trousers.jpg",
    "images": [
      "assets/product-trousers.jpg"
    ],
    "description": "Easy-stretch slim chinos that dress up or down.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "28",
      "30",
      "32",
      "34",
      "36"
    ],
    "colors": [
      "Khaki",
      "Olive"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.4
  },
  {
    "name": "Mini Everyday Backpack",
    "price": 549,
    "category": "bags",
    "image": "assets/product-backpack.jpg",
    "images": [
      "assets/product-backpack.jpg"
    ],
    "description": "A compact backpack for college, commute and short trips.",
    "originalPrice": 799,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Navy"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Oversized Drop-Shoulder Tee",
    "price": 449,
    "category": "clothing",
    "image": "assets/product-tshirt.jpg",
    "images": [
      "assets/product-tshirt.jpg"
    ],
    "description": "A roomy drop-shoulder tee in heavy cotton.",
    "originalPrice": 599,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Beige"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.4
  },
  {
    "name": "V-Neck Cotton Tee",
    "price": 349,
    "category": "clothing",
    "image": "assets/product-tshirt.jpg",
    "images": [
      "assets/product-tshirt.jpg"
    ],
    "description": "A clean everyday v-neck in soft combed cotton.",
    "originalPrice": 499,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "White",
      "Grey"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Striped Casual Shirt",
    "price": 549,
    "category": "clothing",
    "image": "assets/product-shirt.jpg",
    "images": [
      "assets/product-shirt.jpg"
    ],
    "description": "A light striped shirt for college and weekends.",
    "originalPrice": 799,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Blue",
      "White"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Checked Flannel Shirt",
    "price": 649,
    "category": "clothing",
    "image": "assets/product-shirt.jpg",
    "images": [
      "assets/product-shirt.jpg"
    ],
    "description": "A warm checked shirt that layers easily.",
    "originalPrice": 899,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Red",
      "Green"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.4
  },
  {
    "name": "Half Sleeve Linen Shirt",
    "price": 599,
    "category": "clothing",
    "image": "assets/product-linen-shirt.jpg",
    "images": [
      "assets/product-linen-shirt.jpg"
    ],
    "description": "Breathable half-sleeve shirt for hot days.",
    "originalPrice": 799,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Sand",
      "White"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Pullover Fleece Hoodie",
    "price": 749,
    "category": "clothing",
    "image": "assets/product-hoodie.jpg",
    "images": [
      "assets/product-hoodie.jpg"
    ],
    "description": "A cosy fleece-lined pullover hoodie.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Maroon",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.5
  },
  {
    "name": "Basic Crew Sweatshirt",
    "price": 549,
    "category": "clothing",
    "image": "assets/product-sweatshirt.jpg",
    "images": [
      "assets/product-sweatshirt.jpg"
    ],
    "description": "A simple crew-neck sweatshirt for everyday wear.",
    "originalPrice": 799,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Grey",
      "Navy"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Tapered Fit Jeans",
    "price": 699,
    "category": "clothing",
    "image": "assets/product-jeans.jpg",
    "images": [
      "assets/product-jeans.jpg"
    ],
    "description": "Comfortable tapered jeans with a little stretch.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "28",
      "30",
      "32",
      "34",
      "36"
    ],
    "colors": [
      "Black",
      "Blue"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.4
  },
  {
    "name": "Cargo Pocket Trousers",
    "price": 699,
    "category": "clothing",
    "image": "assets/product-trousers.jpg",
    "images": [
      "assets/product-trousers.jpg"
    ],
    "description": "Utility cargo trousers with roomy side pockets.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "28",
      "30",
      "32",
      "34",
      "36"
    ],
    "colors": [
      "Olive",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Track Pants Joggers",
    "price": 449,
    "category": "clothing",
    "image": "assets/product-trousers.jpg",
    "images": [
      "assets/product-trousers.jpg"
    ],
    "description": "Soft track pants for gym, travel and home.",
    "originalPrice": 599,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black",
      "Grey"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.2
  },
  {
    "name": "Light Windcheater Jacket",
    "price": 799,
    "category": "clothing",
    "image": "assets/product-bomber.jpg",
    "images": [
      "assets/product-bomber.jpg"
    ],
    "description": "A lightweight jacket for breezy days and rain.",
    "originalPrice": 1099,
    "featured": false,
    "stock": 60,
    "sizes": [
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Navy",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Low-Top Canvas Shoes",
    "price": 599,
    "category": "shoes",
    "image": "assets/product-white-sneakers.jpg",
    "images": [
      "assets/product-white-sneakers.jpg"
    ],
    "description": "Easy canvas shoes with a cushioned insole.",
    "originalPrice": 799,
    "featured": false,
    "stock": 60,
    "sizes": [
      "6",
      "7",
      "8",
      "9",
      "10"
    ],
    "colors": [
      "White",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Slip-On Casual Sneakers",
    "price": 699,
    "category": "shoes",
    "image": "assets/product-retro-sneakers.jpg",
    "images": [
      "assets/product-retro-sneakers.jpg"
    ],
    "description": "Laceless slip-ons for quick everyday wear.",
    "originalPrice": 999,
    "featured": false,
    "stock": 60,
    "sizes": [
      "6",
      "7",
      "8",
      "9",
      "10"
    ],
    "colors": [
      "Grey",
      "Navy"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Laptop Backpack 20L",
    "price": 799,
    "category": "bags",
    "image": "assets/product-backpack.jpg",
    "images": [
      "assets/product-backpack.jpg"
    ],
    "description": "A 20L backpack with a padded laptop sleeve.",
    "originalPrice": 1099,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Grey"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.4
  },
  {
    "name": "Printed Shopper Tote",
    "price": 299,
    "category": "bags",
    "image": "assets/product-tote.jpg",
    "images": [
      "assets/product-tote.jpg"
    ],
    "description": "A light printed tote for groceries and college.",
    "originalPrice": 399,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Natural",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.2
  },
  {
    "name": "Aviator Sunglasses",
    "price": 449,
    "category": "eyewear",
    "image": "assets/product-sunglasses.jpg",
    "images": [
      "assets/product-sunglasses.jpg"
    ],
    "description": "Classic aviators with UV protection.",
    "originalPrice": 599,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Gold",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Blue-Light Screen Glasses",
    "price": 499,
    "category": "eyewear",
    "image": "assets/product-glasses.jpg",
    "images": [
      "assets/product-glasses.jpg"
    ],
    "description": "Anti-glare frames for long screen hours.",
    "originalPrice": 699,
    "featured": false,
    "stock": 60,
    "sizes": [
      "One Size"
    ],
    "colors": [
      "Black",
      "Clear"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.3
  },
  {
    "name": "Casual Canvas Belt",
    "price": 299,
    "category": "accessories",
    "image": "assets/product-belt.jpg",
    "images": [
      "assets/product-belt.jpg"
    ],
    "description": "A sturdy canvas belt with a metal buckle.",
    "originalPrice": 399,
    "featured": false,
    "stock": 60,
    "sizes": [
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Olive",
      "Black"
    ],
    "active": true,
    "brand": "VASTRA",
    "rating": 4.2
  }
];

// Syncs the catalog into MongoDB (also called automatically when the server starts).
async function syncProducts() {
  // Hide the old demo/electronics catalog so only the curated fashion collection is public.
  await Product.updateMany({ name: { $nin: products.map(p => p.name) } }, { $set: { active: false } });
  for (const product of products) {
    await Product.findOneAndUpdate(
      { name: product.name, category: product.category },
      { $set: product },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
  // Safety net: nothing in the shop may cost ₹1000 or more.
  await Product.updateMany({ price: { $gt: 999 } }, { $set: { price: 999 } });
  return products.length;
}
module.exports = { products, syncProducts };

async function main() {
  await connectDB();
  console.log(`Seeded/updated ${await syncProducts()} curated VASTRA fashion products (all under ₹1000).`);
}
if (require.main === module) {
  main().catch(err => { console.error("Product seeding failed:", err.message); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect().catch(() => {}); });
}
