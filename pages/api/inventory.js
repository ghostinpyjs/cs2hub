export default async function handler(req, res) {
  const { steamid } = req.query;
  if (!steamid) return res.status(400).json({ error: 'steamid required' });
  try {
    const r = await fetch(`https://steamcommunity.com/inventory/${steamid}/730/2?l=portuguese&count=500`);
    if (!r.ok) {
      if (r.status === 403) return res.status(403).json({ error: 'Inventário privado. Torne seu inventário público no Steam.' });
      return res.status(r.status).json({ error: 'Falha ao buscar inventário' });
    }
    const data = await r.json();
    if (!data?.assets) return res.status(200).json({ items: [], total: 0 });
    const rarityOrder = ['Contraband','Covert','Classified','Restricted','Mil-Spec Grade','Industrial Grade','Consumer Grade','Base Grade'];
    const items = data.assets.map(asset => {
      const desc = data.descriptions?.find(d => d.classid === asset.classid && d.instanceid === asset.instanceid);
      return {
        assetid: asset.assetid, classid: asset.classid,
        name: desc?.name || 'Unknown',
        market_name: desc?.market_name || desc?.name || 'Unknown',
        market_hash_name: desc?.market_hash_name || '',
        type: desc?.type || '',
        rarity: desc?.tags?.find(t => t.category === 'Rarity')?.localized_tag_name || '',
        rarity_color: desc?.tags?.find(t => t.category === 'Rarity')?.color || 'b0c3d9',
        exterior: desc?.tags?.find(t => t.category === 'Exterior')?.localized_tag_name || '',
        weapon_type: desc?.tags?.find(t => t.category === 'Weapon')?.localized_tag_name || '',
        icon_url: desc?.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}/256fx256f` : null,
        tradable: desc?.tradable === 1, marketable: desc?.marketable === 1,
      };
    });
    items.sort((a, b) => { const ai = rarityOrder.indexOf(a.rarity), bi = rarityOrder.indexOf(b.rarity); return (ai===-1?99:ai)-(bi===-1?99:bi); });
    return res.status(200).json({ items, total: items.length });
  } catch { return res.status(500).json({ error: 'Erro interno' }); }
}
