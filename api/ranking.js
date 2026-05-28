import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;

  try {
    // Tentar com service key primeiro, depois anon
    const db = createClient(url, key || anon);
    
    const { data, count, error } = await db
      .from("players")
      .select("*", { count: "exact" });

    if (error) return res.status(500).json({ error: error.message });
    
    const ranked = (data || []).map((p, i) => ({ ...p, rank: i + 1 }));
    return res.status(200).json({ players: ranked, total: count ?? 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
