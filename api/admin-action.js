import { createClient } from "@supabase/supabase-js";

const ADMIN_ID = "76561199851942884";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { action, admin_id, steam_id, value, id } = req.body;
    if (admin_id !== ADMIN_ID) return res.status(403).json({ error: "Acesso negado" });

    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    if (action === "ban") {
      await db.from("players").update({ banned: value }).eq("steam_id", steam_id);
    } else if (action === "delete") {
      await db.from("marketplace").delete().eq("steam_id", steam_id);
      await db.from("players").delete().eq("steam_id", steam_id);
    } else if (action === "remove_listing") {
      await db.from("marketplace").update({ status: "removed" }).eq("id", id);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
