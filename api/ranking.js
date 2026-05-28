import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  // Debug: mostrar se as variáveis existem
  if (!url || !key) {
    return res.status(500).json({ 
      error: "Variáveis faltando",
      has_url: !!url,
      has_key: !!key
    });
  }

  try {
    const db = createClient(url, key);
    const { sort = "hours", page = "1", limit = "50" } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const validSort = ["elo","kd","kills","hours","steam_level","inventory_value"];
    const sortCol = validSort.includes(sort) ? sort : "hours";
    const from = (pageNum - 1) * limitNum;
    const to   = from + limitNum - 1;

    const { data: players, count, error } = await db
      .from("players")
      .select("*", { count: "exact" })
      .order(sortCol, { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message, details: error });

    const ranked = (players || []).map((p, i) => ({ ...p, rank: from + i + 1 }));
    return res.status(200).json({ players: ranked, total: count ?? 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
