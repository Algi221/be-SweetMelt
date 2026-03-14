import { supabase } from "./src/lib/supabase";

async function checkSchema() {
  const { data, error } = await supabase.from("order_items").select("*").limit(1);
  if (error) {
    console.error("Error fetching order_items:", error);
  } else if (data && data.length > 0) {
    console.log("Order items columns:", Object.keys(data[0]));
  } else {
    // If table is empty, we can try to insert a dummy and see or use information_schema
    const { data: cols, error: err } = await supabase.rpc('get_columns', { table_name: 'order_items' });
    if (err) {
       console.log("Could not get columns via RPC, trying to desc table if possible");
    } else {
       console.log("Columns:", cols);
    }
  }
}
checkSchema();
