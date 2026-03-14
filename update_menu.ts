import { supabase } from "./src/lib/supabase";

async function updateMenu() {
  console.log("Cleaning up categories...");
  const { data: currentCategories } = await supabase.from("categories").select("*");
  const names = currentCategories?.map(c => c.name) || [];
  console.log("Current Categories:", names);

  const toRemove = ["Brownies", "Chocolate", "Ice Cream", "Lumer Cheese", "Oreo Dessert"];
  
  for (const catName of toRemove) {
    const cat = currentCategories?.find(c => c.name === catName);
    if (cat) {
      console.log(`Deleting category and products for: ${catName}`);
      await supabase.from("products").delete().eq("category_id", cat.id);
      await supabase.from("categories").delete().eq("id", cat.id);
    }
  }

  // Ensure Silky Pudding
  console.log("Ensuring Silky Pudding exists...");
  let { data: silkyCat } = await supabase.from("categories").select("*").eq("name", "Silky Pudding").single();
  if (!silkyCat) {
    const { data } = await supabase.from("categories").insert({ name: "Silky Pudding", icon: "🍮" }).select().single();
    silkyCat = data;
  }

  // Ensure Oreo Cheese
  console.log("Ensuring Oreo Cheese exists...");
  let { data: oreoCat } = await supabase.from("categories").select("*").eq("name", "Oreo Cheese").single();
  if (!oreoCat) {
    const { data } = await supabase.from("categories").insert({ name: "Oreo Cheese", icon: "🧀" }).select().single();
    oreoCat = data;
  }

  if (oreoCat) {
     const { data: existingOreoProducts } = await supabase.from("products").select("*").eq("category_id", oreoCat.id);
     if (!existingOreoProducts?.length) {
        console.log("Adding sample Oreo Cheese product");
        await supabase.from("products").insert([
          { 
            name: "Oreo Cheese Original", 
            description: "Delicious Oreo with cheese melt", 
            price: 15000, 
            category_id: oreoCat.id,
            image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=1964&auto=format&fit=crop"
          }
        ]);
     }
  }

  console.log("Done. Menu now only contains Silky Pudding and Oreo Cheese.");
}

updateMenu();
