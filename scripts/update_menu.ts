import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const updateMenu = async () => {
  console.log("Updating menu...");

  // 1. Disable all current products
  const { error: disableError } = await supabase
    .from("products")
    .update({ is_available: false })
    .neq("name", "___nonexistent___"); // Update all

  if (disableError) {
    console.error("Error disabling products:", disableError);
    return;
  }

  // 2. Ensure Categories exist
  const categories = [
    { name: "Oreo Dessert", slug: "oreo-dessert", icon: "🍪" },
    { name: "Silky Pudding", slug: "silky-pudding", icon: "🍮" }
  ];

  for (const cat of categories) {
    const { data: existingCat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", cat.slug)
      .single();

    if (!existingCat) {
      await supabase.from("categories").insert(cat);
    }
  }

  // Get Category IDs
  const { data: catData } = await supabase.from("categories").select("id, slug");
  const getCatId = (slug: string) => catData?.find(c => c.slug === slug)?.id;

  // 3. Define the 3 items
  const products = [
    {
      name: "Oreo Cheese",
      description: "Cheesecake lumer dengan biskuit Oreo yang melimpah. Perpaduan sempurna keju dan Oreo.",
      price: 10000,
      image_url: "/images/oreoCheesseCake/1.jpeg",
      is_available: true,
      category_id: getCatId("oreo-dessert")
    },
    {
      name: "Silky Pudding Ball",
      description: "Puding sutra lembut nan mewah. Perpaduan tekstur lembut dan rasa yang nikmat. Tersedia rasa Coklat & Strawberry.",
      price: 8000,
      image_url: "/images/pudingCoklat/1.jpeg",
      is_available: true,
      category_id: getCatId("silky-pudding")
    }
  ];

  // 4. Insert or Update Products
  for (const prod of products) {
    const { data: existingProd } = await supabase
      .from("products")
      .select("id")
      .eq("name", prod.name)
      .single();

    if (existingProd) {
      const { error } = await supabase.from("products").update(prod).eq("id", existingProd.id);
      if (error) console.error(`Error updating ${prod.name}:`, error);
    } else {
      const { error } = await supabase.from("products").insert(prod);
      if (error) console.error(`Error inserting ${prod.name}:`, error);
    }
  }

  console.log("Menu updated successfully!");
};

updateMenu();
