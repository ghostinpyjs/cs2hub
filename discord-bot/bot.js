import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } from "discord.js";
import fetch from "node-fetch";

const SITE_URL = process.env.SITE_URL || "https://comycs.vercel.app";
const TOKEN    = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// ─── Registrar comandos slash ─────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName("marketplace")
    .setDescription("Ver anúncios de itens CS2 à venda"),

  new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Ver top 10 jogadores do CS2HUB"),

  new SlashCommandBuilder()
    .setName("jogador")
    .setDescription("Ver perfil de um jogador")
    .addStringOption(o => o.setName("nick").setDescription("Nick do jogador").setRequired(true)),

  new SlashCommandBuilder()
    .setName("jogar")
    .setDescription("Procurar jogadores para jogar CS2")
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo de jogo")
        .setRequired(true)
        .addChoices(
          { name: "Premier", value: "Premier" },
          { name: "Competitivo", value: "Competitivo" },
          { name: "Casual", value: "Casual" },
          { name: "Deathmatch", value: "Deathmatch" },
        )
    )
    .addStringOption(o => o.setName("rank").setDescription("Seu rank/ELO (ex: 12500)").setRequired(false))
    .addStringOption(o => o.setName("obs").setDescription("Observações (ex: preciso de 2 players)").setRequired(false)),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Comandos registrados!");
  } catch (err) {
    console.error("Erro ao registrar comandos:", err);
  }
}

// ─── Eventos ──────────────────────────────────────────────

client.once("ready", async () => {
  console.log(`Bot online como ${client.user.tag}`);
  await registerCommands();
  client.user.setActivity("CS2HUB | /lfg", { type: 0 });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ─── /marketplace ──────────────────────────────────────
  if (commandName === "marketplace") {
    await interaction.deferReply();
    try {
      const res  = await fetch(`${SITE_URL}/api/market-list`);
      const data = await res.json();
      const listings = (data.listings || []).filter(l => l.status === "active").slice(0, 5);

      if (!listings.length) {
        return interaction.editReply("Nenhum item à venda no momento.");
      }

      const embeds = listings.map(l => {
        const embed = new EmbedBuilder()
          .setTitle(l.item_name)
          .setColor(0xf0820f)
          .addFields(
            { name: "Preço", value: `$${parseFloat(l.price_usd).toFixed(2)} | R$ ${parseFloat(l.price_brl||l.price_usd*5).toFixed(2)}`, inline: true },
            { name: "Vendedor", value: l.nick || "Jogador", inline: true },
          )
          .setFooter({ text: "CS2HUB Marketplace" })
          .setURL(`${SITE_URL}/marketplace.html`);

        if (l.description) embed.setDescription(l.description);
        if (l.item_icon)   embed.setThumbnail(`https://community.cloudflare.steamstatic.com/economy/image/${l.item_icon}/200fx150f`);
        return embed;
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ver todos no site")
          .setStyle(ButtonStyle.Link)
          .setURL(`${SITE_URL}/marketplace.html`)
      );

      await interaction.editReply({ content: `🏪 **${listings.length} itens à venda:**`, embeds, components: [row] });
    } catch (err) {
      await interaction.editReply("Erro ao buscar marketplace.");
    }
  }

  // ─── /ranking ──────────────────────────────────────────
  else if (commandName === "ranking") {
    await interaction.deferReply();
    try {
      const res  = await fetch(`${SITE_URL}/ranking-api?limit=10`);
      const data = await res.json();
      const players = data.players || [];

      if (!players.length) return interaction.editReply("Nenhum jogador no ranking ainda.");

      const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
      const desc = players.map((p, i) =>
        `${medals[i]} **${p.nick}** — ${p.hours}h | K/D: ${p.kd} | Lvl: ${p.steam_level}`
      ).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("🏆 Top 10 CS2HUB")
        .setDescription(desc)
        .setColor(0xf0820f)
        .setURL(`${SITE_URL}/ranking.html`)
        .setFooter({ text: "CS2HUB • atualizado a cada login" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ver ranking completo")
          .setStyle(ButtonStyle.Link)
          .setURL(`${SITE_URL}/ranking.html`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      await interaction.editReply("Erro ao buscar ranking.");
    }
  }

  // ─── /jogador ──────────────────────────────────────────
  else if (commandName === "jogador") {
    await interaction.deferReply();
    const nick = interaction.options.getString("nick");
    try {
      const res  = await fetch(`${SITE_URL}/search-api?q=${encodeURIComponent(nick)}`);
      const data = await res.json();
      const players = data.players || [];

      if (!players.length) return interaction.editReply(`Nenhum jogador encontrado com o nick **${nick}**.`);

      const p = players[0];
      const embed = new EmbedBuilder()
        .setTitle(p.nick)
        .setThumbnail(p.avatar)
        .setColor(0xf0820f)
        .addFields(
          { name: "Horas CS2",    value: `${p.hours}h`,         inline: true },
          { name: "K/D",          value: `${p.kd}`,             inline: true },
          { name: "Nível Steam",  value: `${p.steam_level}`,    inline: true },
          { name: "Kills",        value: `${p.kills}`,          inline: true },
          { name: "Vitórias",     value: `${p.wins}`,           inline: true },
          { name: "Headshot %",   value: `${p.hs_percent}%`,    inline: true },
        )
        .setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`)
        .setFooter({ text: "CS2HUB" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ver perfil completo")
          .setStyle(ButtonStyle.Link)
          .setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      await interaction.editReply("Erro ao buscar jogador.");
    }
  }

  // ─── /lfg ──────────────────────────────────────────────
  else if (commandName === "lfg") {
    const modo  = interaction.options.getString("modo");
    const rank  = interaction.options.getString("rank") || "Não informado";
    const obs   = interaction.options.getString("obs")  || "";
    const user  = interaction.user;

    const embed = new EmbedBuilder()
      .setTitle("🎮 Procurando jogadores!")
      .setDescription(obs || "Alguém quer jogar?")
      .setColor(0x00b894)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "👤 Jogador",  value: `<@${user.id}>`,  inline: true },
        { name: "🎯 Modo",     value: modo,              inline: true },
        { name: "📊 Rank/ELO", value: rank,              inline: true },
      )
      .setFooter({ text: "Reaja com ✅ para entrar no grupo!" })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await msg.react("✅");
    await msg.react("❌");
  }
});

client.login(TOKEN);
