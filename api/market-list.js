import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await db
      .from("marketplace")
      .select("*, players(nick, avatar)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const listings = (data || []).map(l => ({
      ...l,
      nick:   l.players?.nick,
      avatar: l.players?.avatar,
    }));

    return res.status(200).json({ listings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
