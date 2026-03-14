import { Hono } from "hono";
import { supabase } from "../lib/supabase";

const products = new Hono();

// GET /api/products - list all products (filter by category_slug optional)
products.get("/", async (c) => {
  const categorySlug = c.req.query("category");

    let query = supabase
    .from("products")
    .select(
      `
      id, name, description, price, image_url, gallery_urls, is_available, created_at,
      categories (id, name, slug, icon)
    `
    )
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  if (categorySlug && categorySlug !== "all") {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();

    if (cat) {
      query = query.eq("category_id", cat.id);
    }
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// GET /api/products/:id - get single product
products.get("/:id", async (c) => {
  const id = c.req.param("id");

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, name, description, price, image_url, gallery_urls, is_available,
      categories (id, name, slug, icon)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return c.json({ error: "Product not found" }, 404);
  }

  return c.json({ data });
});

export default products;
