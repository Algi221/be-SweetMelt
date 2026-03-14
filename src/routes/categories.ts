import { Hono } from "hono";
import { supabase } from "../lib/supabase";

const categories = new Hono();

// GET /api/categories
categories.get("/", async (c) => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, icon")
    .order("name");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

export default categories;
