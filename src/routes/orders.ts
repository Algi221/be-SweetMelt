import { Hono } from "hono";
import { supabase } from "../lib/supabase";

const orders = new Hono();

interface OrderItem {
  product_id: string;
  quantity: number;
  variant?: string;
}

interface CreateOrderBody {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  pickup_time?: string;
  pickup_location?: string;
  pickup_room?: string;
  notes?: string;
  payment_method: string;
  items: OrderItem[];
}

// POST /api/orders — create new order
orders.post("/", async (c) => {
  const body: CreateOrderBody = await c.req.json();

  const {
    customer_name,
    customer_phone,
    customer_address,
    pickup_time,
    pickup_location,
    pickup_room,
    notes,
    payment_method,
    items,
  } = body;

  // Validate required fields
  if (
    !customer_name ||
    !customer_phone ||
    !customer_address ||
    !payment_method ||
    !items?.length
  ) {
    console.warn("[Order] Missing fields:", { customer_name, customer_phone, customer_address, payment_method, itemsCount: items?.length });
    return c.json({ error: "Semua field wajib diisi dan minimal 1 item" }, 400);
  }

  // Fetch product details for each item
  const productIds = items.map((i) => i.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, is_available")
    .in("id", productIds)
    .eq("is_available", true);

  if (productsError) {
    console.error("[Order] Products Fetch Error:", productsError);
    return c.json({ error: "Gagal mengecek ketersediaan produk", details: productsError }, 500);
  }

  if (!products || products.length === 0) {
    return c.json({ error: "Produk tidak ditemukan atau semuanya tidak tersedia" }, 400);
  }

  // Build order items with price snapshot
  let totalPrice = 0;
  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.product_id);
    if (!product) {
      console.error(`[Order] Product ${item.product_id} not found in fetched products`);
      return null;
    }
    const subtotal = product.price * item.quantity;
    totalPrice += subtotal;
    
    // Append variant to name if exists
    const displayName = item.variant ? `${product.name} (${item.variant})` : product.name;

    return {
      product_id: item.product_id,
      product_name: displayName,
      quantity: item.quantity,
      price_at_order: product.price,
    };
  }).filter(Boolean) as any[];

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name,
      customer_phone,
      customer_address,
      pickup_time,
      pickup_location,
      pickup_room,
      notes,
      payment_method,
      customer_email: "noreply@sweetmelt.test", // Placeholder for satisfying non-null constraint
      total_price: totalPrice,
      status: "pending",
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("[Order] Supabase Error:", orderError);
    return c.json({ error: "Gagal membuat order di database", details: orderError }, 500);
  }

  // Insert order items
  const { error: itemsError } = await supabase.from("order_items").insert(
    orderItems.map((oi) => ({ ...oi, order_id: order.id }))
  );

  if (itemsError) {
    console.error("[Order Items] Supabase Error:", itemsError);
    // Rollback order
    await supabase.from("orders").delete().eq("id", order.id);
    return c.json({ error: "Gagal menyimpan item order" }, 500);
  }

  // Send Telegram Notification (Fire-and-forget)
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChatId) {
    const message = `
🔔 *PESANAN BARU MASUK!* 🔔
Order ID: \`${order.id.split("-")[0]}\`
Nama: *${customer_name}*
HP: ${customer_phone}

🛒 *Rincian:*
${orderItems.map((oi) => `- ${oi.quantity}x ${oi.product_name}`).join("\n")}

📍 *Pengambilan:* ${pickup_time || "-"} | ${pickup_location || "-"} ${pickup_room ? `(${pickup_room})` : ""}
📝 *Catatan:* ${notes || "-"}
💰 *Total:* Rp ${totalPrice.toLocaleString("id-ID")}
    `;

    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tgChatId,
        text: message,
        parse_mode: "Markdown",
      }),
    }).catch(console.error); // Ignore TG errors to not block checkout
  }



  return c.json({ success: true, data: order }, 201);
});

// GET /api/orders/:id — get order detail
orders.get("/:id", async (c) => {
  const id = c.req.param("id");

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, customer_name, customer_phone, customer_address,
      pickup_time, pickup_location, pickup_room,
      total_price, status, duitku_reference, duitku_payment_url, payment_method, notes, created_at,
      order_items (product_id, product_name, quantity, price_at_order)
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return c.json({ error: "Order tidak ditemukan" }, 404);
  }

  return c.json({ data });
});

// GET /api/orders — list all orders (Admin)
orders.get("/", async (c) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: "Gagal mengambil data order" }, 500);
  }

  return c.json({ data });
});

// PATCH /api/orders/:id/status — update order status (Admin)
orders.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const { status } = await c.req.json();

  if (!status) {
    return c.json({ error: "status wajib diisi" }, 400);
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: "Gagal mengupdate status order" }, 500);
  }

  return c.json({ success: true, data });
});

export default orders;
