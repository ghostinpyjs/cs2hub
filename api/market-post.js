import { createClient } from "@supabase/supabase-js";
const getDB = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  try {
    const { steam_id, item_name, item_icon, price_usd, price_brl, description, discord_user } = req.body;
    if (!steam_id || !item_name || !price_usd)
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    if (!discord_user)
      return res.status(400).json({ error: "Informe seu usuário do Discord" });

    const { data, error } = await getDB().from("marketplace").insert({
      steam_id,
      item_name,
      item_icon:    item_icon    || "",
      price_usd:    parseFloat(price_usd),
      price_brl:    parseFloat(price_brl || price_usd * 5),
      description:  description  || "",
      discord_user: discord_user.trim(),
      status:       "active",
      created_at:   Date.now(),
    }).select().single();

    if (error) throw error;
    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
