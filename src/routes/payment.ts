import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import midtransClient from "midtrans-client";

const payment = new Hono();

// Configure Midtrans Snap
console.log("[Midtrans] Init Mode:", process.env.MIDTRANS_IS_PRODUCTION === "true" ? "PRODUCTION" : "SANDBOX");
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY || "",
  clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
});

// POST /api/payment/create
payment.post("/create", async (c) => {
  try {
    const { order_id } = await c.req.json();

    if (!order_id) {
      return c.json({ error: "order_id wajib diisi" }, 400);
    }

    // Fetch order from DB
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(product_name, quantity, price_at_order)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return c.json({ error: "Order tidak ditemukan" }, 404);
    }

    const orderId = `SM-${order.id.substring(0, 8).toUpperCase()}-${Date.now()}`;
    const amount = order.total_price;

    const itemDetails = order.order_items.map((item: any, idx: number) => ({
      id: `ITEM-${idx + 1}`,
      price: item.price_at_order,
      quantity: item.quantity,
      name: item.product_name,
    }));

    // Midtrans Transaction Parameters
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: order.customer_name.split(" ")[0],
        last_name: order.customer_name.split(" ").slice(1).join(" ") || "-",
        email: order.customer_email || "customer@sweetmelt.test",
        phone: order.customer_phone,
      },
      // Store the real UUID in a custom field for the notification handler
      custom_field1: order.id,
      // Optional: Redirect URLs
      callbacks: {
        finish: `${process.env.MIDTRANS_FRONTEND_URL}/order/${order.id}`,
        error: `${process.env.MIDTRANS_FRONTEND_URL}/order/${order.id}?status=error`,
        pending: `${process.env.MIDTRANS_FRONTEND_URL}/order/${order.id}?status=pending`,
      }
    };

    console.log("[Midtrans] Creating Snap Transaction:", orderId);
    
    // Create Snap Transaction
    const transaction = await snap.createTransaction(parameter);

    // Save Midtrans reference/URL to order (we reuse the existings columns for simplicity or add new ones if needed)
    // Here we use duitku_payment_url and duitku_reference just as placeholders to avoid DB schema changes
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        duitku_payment_url: transaction.redirect_url, // Reuse existing column for now
        duitku_reference: transaction.token,        // Reuse existing column for now
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[Midtrans] Failed to update order with payment info:", updateError);
    }

    return c.json({
      success: true,
      paymentUrl: transaction.redirect_url,
      token: transaction.token,
      order_id: orderId,
    });
  } catch (error: any) {
    console.error("[Midtrans] Error creating transaction:", error);
    return c.json({ error: "Gagal membuat transaksi Midtrans", details: error.message }, 500);
  }
});

/**
 * Midtrans Notification / Webhook Handler
 * POST /api/payment/notification
 */
payment.post("/callback", async (c) => {
  try {
    const notificationJson = await c.req.json();
    
    // Verify notification authenticity with Midtrans
    const statusResponse = await snap.transaction.notification(notificationJson);
    
    const orderIdStr = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;
    const originalOrderId = statusResponse.custom_field1; // This is our UUID

    console.log(`[Midtrans] Notification: Order ${originalOrderId} (${statusResponse.order_id}). Status: ${transactionStatus}`);

    if (!originalOrderId) {
      return c.json({ error: "No original order id" }, 400);
    }
    
    let status = "pending";

    if (transactionStatus == 'capture') {
      if (fraudStatus == 'challenge') {
        status = 'pending';
      } else if (fraudStatus == 'accept') {
        status = 'paid';
      }
    } else if (transactionStatus == 'settlement') {
      status = 'paid';
    } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
      status = 'failed';
    } else if (transactionStatus == 'pending') {
      status = 'pending';
    }

    // Update the order in Supabase
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", originalOrderId);

    if (updateError) {
      console.error("[Midtrans Callback] DB Update Error:", updateError);
      return c.json({ error: "database error" }, 500);
    }
    
    return c.json({ status: "ok" });
  } catch (err) {
    console.error("[Midtrans Callback] Error:", err);
    return c.json({ error: "error" }, 500);
  }
});

// GET /api/payment/status/:orderId
payment.get("/status/:orderId", async (c) => {
  const orderId = c.req.param("orderId");

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, duitku_reference, total_price, customer_name")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return c.json({ error: "Order tidak ditemukan" }, 404);
  }

  return c.json({ data: order });
});

export default payment;
