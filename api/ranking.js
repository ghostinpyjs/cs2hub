// api/ranking.js
import { createClient } from "@supabase/supabase-js";

const supabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { sort = "hours", page = "1", limit = "50" } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const validSort = ["elo","kd","kills","hours","steam_level","inventory_value"];
  const sortCol = validSort.includes(sort) ? sort : "hours";

  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  const db = supabase();
  const { data: players, count } = await db
    .from("players")
    .select("*", { count: "exact" })
    .order(sortCol, { ascending: false })
    .range(from, to);

  const ranked = (players || []).map((p, i) => ({ ...p, rank: from + i + 1 }));
  return res.status(200).json({ players: ranked, total: count ?? 0 });
}
