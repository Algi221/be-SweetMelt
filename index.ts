import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import products from "./src/routes/products";
import categories from "./src/routes/categories";
import orders from "./src/routes/orders";
import payment from "./src/routes/payment";
import otp from "./src/routes/otp";

const app = new Hono();

// Middleware
app.use(
  "*",
  cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);
app.use("*", logger());

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "SweetMelt API 🍪" }));

// Routes
app.route("/api/products", products);
app.route("/api/categories", categories);
app.route("/api/orders", orders);
app.route("/api/payment", payment);
app.route("/api/otp", otp);

// 404 handler
app.notFound((c) => c.json({ error: "Route not found" }, 404));

const PORT = parseInt(process.env.PORT || "3001");

console.log(`🍪 SweetMelt API running on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
