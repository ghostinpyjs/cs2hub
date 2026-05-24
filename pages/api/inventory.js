export default async function handler(req, res) {
  const { steamid } = req.query;

  if (!steamid) {
    return res.status(400).json({ error: 'steamid required' });
  }

  try {
    // CS2 app_id = 730, context_id = 2
    const response = await fetch(
      `https://steamcommunity.com/inventory/${steamid}/730/2?l=portuguese&count=500`
    );

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({ error: 'Inventário privado. Torne seu inventário público no Steam para visualizá-lo.' });
      }
      return res.status(response.status).json({ error: 'Falha ao buscar inventário' });
    }

    const data = await response.json();

    if (!data || !data.assets) {
      return res.status(200).json({ items: [], total: 0 });
    }

    // Combine assets with descriptions
    const items = data.assets.map(asset => {
      const desc = data.descriptions?.find(
        d => d.classid === asset.classid && d.instanceid === asset.instanceid
      );
      return {
        assetid: asset.assetid,
        classid: asset.classid,
        instanceid: asset.instanceid,
        amount: asset.amount,
        name: desc?.name || 'Unknown',
        market_name: desc?.market_name || desc?.name || 'Unknown',
        market_hash_name: desc?.market_hash_name || '',
        type: desc?.type || '',
        rarity: desc?.tags?.find(t => t.category === 'Rarity')?.localized_tag_name || '',
        rarity_color: desc?.tags?.find(t => t.category === 'Rarity')?.color || 'b0c3d9',
        exterior: desc?.tags?.find(t => t.category === 'Exterior')?.localized_tag_name || '',
        weapon_type: desc?.tags?.find(t => t.category === 'Weapon')?.localized_tag_name || '',
        icon_url: desc?.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}/256fx256f` : null,
        tradable: desc?.tradable === 1,
        marketable: desc?.marketable === 1,
        descriptions: desc?.descriptions || [],
        stickers: desc?.descriptions?.filter(d => d.value?.includes('sticker')) || [],
        namecolor: desc?.name_color || null,
        background_color: desc?.background_color || null,
        commodity: desc?.commodity || 0,
      };
    });

    // Sort by rarity (rare first)
    const rarityOrder = ['Contraband', 'Covert', 'Classified', 'Restricted', 'Mil-Spec Grade', 'Industrial Grade', 'Consumer Grade', 'Base Grade'];
    items.sort((a, b) => {
      const ai = rarityOrder.indexOf(a.rarity);
      const bi = rarityOrder.indexOf(b.rarity);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno ao buscar inventário' });
  }
}
