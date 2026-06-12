import { createClient } from "@supabase/supabase-js";
const getDB = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id obrigatório" });
    const { error } = await getDB()
      .from("marketplace")
      .update({ status: "removed", removed_at: Date.now() })
      .eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
