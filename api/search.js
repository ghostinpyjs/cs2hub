// api/search.js
import { createClient } from "@supabase/supabase-js";

const supabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ error: "Query must have at least 2 characters" });

  const query = q.trim();
  const db = supabase();

  // Se parece com SteamID (17 dígitos)
  if (/^\d{17}$/.test(query)) {
    const { data } = await db.from("players").select("*").eq("steam_id", query).single();
    return res.status(200).json({ players: data ? [data] : [] });
  }

  // Busca por nick (case-insensitive)
  const { data } = await db.from("players").select("*").ilike("nick", `%${query}%`).limit(20);
  return res.status(200).json({ players: data || [] });
}
