import { createClient } from "@supabase/supabase-js";
const ADMIN_ID = "76561199851942884";
const getDB = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });
  try {
    const { steam_id, banned, reason } = req.body;
    if (!steam_id) return res.status(400).json({ error: "steam_id obrigatório" });
    if (steam_id === ADMIN_ID) return res.status(403).json({ error: "Não é possível banir o admin" });
    const update = { banned: !!banned };
    if (banned && reason) update.ban_reason = reason;
    update.banned_at = banned ? Date.now() : null;
    const { error } = await getDB().from("players").update(update).eq("steam_id", steam_id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
