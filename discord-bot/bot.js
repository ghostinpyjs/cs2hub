import {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes,
  ChannelType, PermissionFlagsBits
} from "discord.js";
import fetch from "node-fetch";

const SITE_URL  = process.env.SITE_URL  || "https://cs2hubs.vercel.app";
const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const ORANGE    = 0xf0820f;
const GREEN     = 0x00b894;
const RED       = 0xe74c3c;

if (!TOKEN)     { console.error("❌ DISCORD_TOKEN não definido!");     process.exit(1); }
if (!CLIENT_ID) { console.error("❌ DISCORD_CLIENT_ID não definido!"); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

const gruposAtivos = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Ver top jogadores do CS2HUB")
    .addStringOption(o => o.setName("ordem").setDescription("Ordenar por").setRequired(false)
      .addChoices(
        { name: "⏱ Horas",          value: "hours" },
        { name: "⚔️ K/D",            value: "kd" },
        { name: "💀 Kills",          value: "kills" },
        { name: "🏆 Vitórias",       value: "wins" },
        { name: "🎮 Nível Steam",    value: "steam_level" },
        { name: "💰 Inventário",     value: "inventory_value" },
      )),

  new SlashCommandBuilder()
    .setName("jogador")
    .setDescription("Ver perfil completo de um jogador")
    .addStringOption(o => o.setName("nick").setDescription("Nick ou SteamID").setRequired(true)),

  new SlashCommandBuilder()
    .setName("marketplace")
    .setDescription("Ver itens CS2 à venda")
    .addIntegerOption(o => o.setName("pagina").setDescription("Página").setRequired(false)),

  new SlashCommandBuilder()
    .setName("lfg")
    .setDescription("Procurar jogadores para uma partida — cria canal privado automaticamente!")
    .addStringOption(o => o.setName("modo").setDescription("Modo de jogo").setRequired(true)
      .addChoices(
        { name: "🏆 Premier",     value: "Premier" },
        { name: "⚔️ Competitivo", value: "Competitivo" },
        { name: "💀 Deathmatch",  value: "Deathmatch" },
        { name: "🎮 Casual",      value: "Casual" },
        { name: "🔫 Arms Race",   value: "Arms Race" },
        { name: "🗡️ Wingman",     value: "Wingman" },
      ))
    .addStringOption(o => o.setName("rank").setDescription("Seu rank/ELO ex: 12500").setRequired(false))
    .addIntegerOption(o => o.setName("vagas").setDescription("Quantas vagas? (1-4)").setRequired(false).setMinValue(1).setMaxValue(4))
    .addStringOption(o => o.setName("obs").setDescription("Observações").setRequired(false)),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Comparar stats de dois jogadores")
    .addStringOption(o => o.setName("jogador1").setDescription("Primeiro jogador").setRequired(true))
    .addStringOption(o => o.setName("jogador2").setDescription("Segundo jogador").setRequired(true)),

  new SlashCommandBuilder()
    .setName("top")
    .setDescription("Ver o melhor jogador em uma categoria")
    .addStringOption(o => o.setName("categoria").setDescription("Categoria").setRequired(true)
      .addChoices(
        { name: "⏱ Mais horas",           value: "hours" },
        { name: "⚔️ Melhor K/D",           value: "kd" },
        { name: "💀 Mais kills",           value: "kills" },
        { name: "🏆 Mais vitórias",        value: "wins" },
        { name: "💰 Inventário mais caro", value: "inventory_value" },
      )),

  new SlashCommandBuilder()
    .setName("site")
    .setDescription("Links e informações do CS2HUB"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ver latência do bot"),

].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Comandos slash registrados!");
  } catch (err) {
    console.error("❌ Erro ao registrar comandos:", err);
  }
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch { return {}; }
}

async function getPlayer(nick) {
  const data = await fetchJSON(`${SITE_URL}/search-api?q=${encodeURIComponent(nick)}`);
  return data.players?.[0] || null;
}

async function criarCanalGrupo(guild, leader, players, modo, grupoId) {
  try {
    let categoria = guild.channels.cache.find(c =>
      c.type === ChannelType.GuildCategory && c.name === "🎮 CS2 GRUPOS"
    );
    if (!categoria) {
      categoria = await guild.channels.create({
        name: "🎮 CS2 GRUPOS",
        type: ChannelType.GuildCategory,
      });
    }
    const canal = await guild.channels.create({
      name: `🎯-${modo.toLowerCase().replace(/ /g, "-")}-${grupoId}`,
      type: ChannelType.GuildText,
      parent: categoria.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: leader.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ...players.map(p => ({ id: p.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })),
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
      ],
      topic: `Grupo ${modo} | Líder: ${leader.username} | ${players.length + 1} jogadores`,
    });
    return canal;
  } catch (err) {
    console.error("Erro ao criar canal:", err);
    return null;
  }
}

// ─── Keep-alive HTTP (necessário para o Render não dormir) ───────────────────
import http from "http";
http.createServer((_, res) => res.end("OK")).listen(process.env.PORT || 3000, () => {
  console.log("🌐 Keep-alive HTTP rodando");
});

// ─── Ready ───────────────────────────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  await registerCommands();
  client.user.setActivity("CS2HUB | /lfg /ranking", { type: 0 });
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // ── Botões ──
  if (interaction.isButton()) {
    const [acao, grupoId] = interaction.customId.split("_");
    const grupo = gruposAtivos.get(grupoId);
    if (!grupo) return interaction.reply({ content: "❌ Esse grupo não existe mais.", ephemeral: true });

    if (acao === "entrar") {
      if (interaction.user.id === grupo.leader.id)
        return interaction.reply({ content: "❌ Você é o líder do grupo!", ephemeral: true });
      if (grupo.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: "✅ Você já está no grupo!", ephemeral: true });
      if (grupo.players.length >= grupo.vagas)
        return interaction.reply({ content: "❌ Grupo cheio!", ephemeral: true });

      grupo.players.push(interaction.user);
      gruposAtivos.set(grupoId, grupo);
      await interaction.reply({ content: `✅ **${interaction.user.username}** entrou no grupo!` });

      if (grupo.players.length >= grupo.vagas) {
        const canal = await criarCanalGrupo(interaction.guild, grupo.leader, grupo.players, grupo.modo, grupoId);
        if (canal) {
          gruposAtivos.delete(grupoId);
          const todos    = [grupo.leader, ...grupo.players];
          const mencoes  = todos.map(p => `<@${p.id}>`).join(" ");
          const embedOk  = new EmbedBuilder()
            .setTitle(`🎮 Grupo ${grupo.modo} formado!`)
            .setDescription(`${mencoes}\n\nSeu grupo está pronto!`)
            .setColor(GREEN)
            .addFields(
              { name: "🎯 Modo",      value: grupo.modo,             inline: true },
              { name: "👥 Jogadores", value: `${todos.length}`,      inline: true },
              { name: "🔗 Site",      value: `[CS2HUB](${SITE_URL})`, inline: true },
            )
            .setFooter({ text: "Canal deletado automaticamente em 2 horas" })
            .setTimestamp();
          const rowCanal = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fechar_${grupoId}`).setLabel("🗑️ Fechar grupo").setStyle(ButtonStyle.Danger),
          );
          await canal.send({ content: mencoes, embeds: [embedOk], components: [rowCanal] });
          setTimeout(async () => { try { await canal.delete(); } catch (_) {} }, 7200000);
          try {
            const msg = await interaction.channel.messages.fetch(grupo.messageId);
            await msg.edit({ embeds: [new EmbedBuilder().setTitle("✅ Grupo formado!").setDescription(`Canal criado: ${canal}`).setColor(GREEN)], components: [] });
          } catch (_) {}
        }
      }
      return;
    }

    if (acao === "sair") {
      if (interaction.user.id === grupo.leader.id) {
        gruposAtivos.delete(grupoId);
        try {
          const msg = await interaction.channel.messages.fetch(grupo.messageId);
          await msg.edit({ embeds: [new EmbedBuilder().setTitle("❌ Grupo cancelado").setDescription(`Líder **${grupo.leader.username}** cancelou.`).setColor(RED)], components: [] });
        } catch (_) {}
        return interaction.reply({ content: "✅ Grupo cancelado.", ephemeral: true });
      }
      const idx = grupo.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: "❌ Você não está no grupo.", ephemeral: true });
      grupo.players.splice(idx, 1);
      gruposAtivos.set(grupoId, grupo);
      return interaction.reply({ content: `👋 **${interaction.user.username}** saiu do grupo.` });
    }

    if (acao === "fechar") {
      await interaction.reply({ content: "🗑️ Fechando canal em 5 segundos..." });
      setTimeout(async () => { try { await interaction.channel.delete(); } catch (_) {} }, 5000);
      return;
    }
    return;
  }

  // ── Slash commands ──
  const { commandName } = interaction;

  if (commandName === "ping") {
    const ms = Date.now() - interaction.createdTimestamp;
    return interaction.reply(`🏓 Pong! Latência: **${ms}ms** | API: **${client.ws.ping}ms**`);
  }

  if (commandName === "ranking") {
    await interaction.deferReply();
    const ordem   = interaction.options.getString("ordem") || "hours";
    const data    = await fetchJSON(`${SITE_URL}/ranking-api?sort=${ordem}&limit=10`);
    const players = data.players || [];
    if (!players.length) return interaction.editReply("Nenhum jogador no ranking ainda.");
    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const nomes  = { hours:"Horas", kd:"K/D", kills:"Kills", wins:"Vitórias", steam_level:"Nível Steam", inventory_value:"Inventário" };
    const desc   = players.map((p, i) => `${medals[i]} **${p.nick}** — ${p.hours}h | K/D: ${p.kd} | Nível: ${p.steam_level}`).join("\n");
    const embed  = new EmbedBuilder()
      .setTitle(`🏆 Top 10 — ${nomes[ordem] || "Horas"}`)
      .setDescription(desc).setColor(ORANGE)
      .setURL(`${SITE_URL}/ranking.html`)
      .setFooter({ text: `CS2HUB • ${data.total || 0} jogadores` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver ranking completo").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/ranking.html`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  if (commandName === "jogador") {
    await interaction.deferReply();
    const nick = interaction.options.getString("nick");
    const p    = await getPlayer(nick);
    if (!p) return interaction.editReply(`❌ Jogador **${nick}** não encontrado.`);
    const kdVal   = parseFloat(p.kd) || 0;
    const kdEmoji = kdVal >= 1.2 ? "🟢" : kdVal >= 0.85 ? "🟡" : "🔴";
    const embed   = new EmbedBuilder()
      .setTitle(p.nick).setThumbnail(p.avatar).setColor(ORANGE)
      .setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`)
      .addFields(
        { name: "⏱ Horas CS2",     value: `${p.hours}h`,                           inline: true },
        { name: `${kdEmoji} K/D`,   value: `${p.kd}`,                               inline: true },
        { name: "🎮 Nível Steam",   value: `${p.steam_level}`,                      inline: true },
        { name: "💀 Kills",         value: `${(p.kills||0).toLocaleString()}`,       inline: true },
        { name: "🏆 Vitórias",      value: `${(p.wins||0).toLocaleString()}`,        inline: true },
        { name: "🎯 Headshot %",    value: `${p.hs_percent}%`,                       inline: true },
        { name: "⭐ MVPs",          value: `${p.mvps||0}`,                           inline: true },
        { name: "🔫 Arma Favorita", value: `${p.fav_weapon||"N/D"}`,                inline: true },
        { name: "💰 Inventário",    value: `$${(p.inventory_value||0).toFixed(2)}`, inline: true },
      )
      .setFooter({ text: `SteamID: ${p.steam_id}` }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver perfil").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`),
      new ButtonBuilder().setLabel("Perfil Steam").setStyle(ButtonStyle.Link).setURL(p.profile_url || `https://steamcommunity.com/profiles/${p.steam_id}`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  if (commandName === "marketplace") {
    await interaction.deferReply();
    const pagina   = interaction.options.getInteger("pagina") || 1;
    const data     = await fetchJSON(`${SITE_URL}/api/market-list`);
    const ativos   = (data.listings || []).filter(l => l.status === "active");
    const perPage  = 5;
    const listings = ativos.slice((pagina - 1) * perPage, pagina * perPage);
    if (!ativos.length)   return interaction.editReply("🏪 Nenhum item à venda no momento.");
    if (!listings.length) return interaction.editReply(`❌ Página ${pagina} não existe.`);
    const embeds = listings.map(l => {
      const e = new EmbedBuilder().setTitle(l.item_name).setColor(ORANGE)
        .addFields(
          { name: "💵 Preço",    value: `$${parseFloat(l.price_usd).toFixed(2)} | R$ ${parseFloat(l.price_brl||l.price_usd*5).toFixed(2)}`, inline: true },
          { name: "👤 Vendedor", value: l.nick || "Jogador", inline: true },
        ).setURL(`${SITE_URL}/marketplace.html`);
      if (l.description) e.setDescription(l.description);
      if (l.item_icon)   e.setThumbnail(`https://community.cloudflare.steamstatic.com/economy/image/${l.item_icon}/200fx150f`);
      return e;
    });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver no site").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/marketplace.html`),
    );
    return interaction.editReply({ content: `🏪 **${ativos.length} itens à venda** • Página ${pagina}/${Math.ceil(ativos.length/perPage)}`, embeds, components: [row] });
  }

  if (commandName === "lfg") {
    const modo    = interaction.options.getString("modo");
    const rank    = interaction.options.getString("rank")   || "Não informado";
    const vagas   = interaction.options.getInteger("vagas") || 1;
    const obs     = interaction.options.getString("obs")    || "";
    const user    = interaction.user;
    const grupoId = Date.now().toString(36);
    const embed   = new EmbedBuilder()
      .setTitle(`🎮 LFG — ${modo}`).setColor(GREEN).setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "👑 Líder",    value: `<@${user.id}>`, inline: true },
        { name: "🎯 Modo",     value: modo,             inline: true },
        { name: "📊 Rank/ELO", value: rank,             inline: true },
        { name: "🪑 Vagas",    value: `0/${vagas}`,     inline: true },
        { name: "👥 No grupo", value: `<@${user.id}>`,  inline: false },
      )
      .setDescription(obs ? `> ${obs}` : "Clique em **Entrar** para participar!\nQuando o grupo encher, um canal privado será criado automaticamente.")
      .setFooter({ text: `ID: ${grupoId} • Expira em 30 min` }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`entrar_${grupoId}`).setLabel("✅ Entrar no grupo").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`sair_${grupoId}`).setLabel("❌ Sair / Cancelar").setStyle(ButtonStyle.Danger),
    );
    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    gruposAtivos.set(grupoId, { leader: user, players: [], modo, vagas, messageId: msg.id });
    setTimeout(async () => {
      if (!gruposAtivos.has(grupoId)) return;
      gruposAtivos.delete(grupoId);
      try { await msg.edit({ embeds: [new EmbedBuilder().setTitle("⏰ Grupo expirado").setDescription("O grupo expirou sem ser preenchido.").setColor(RED)], components: [] }); } catch (_) {}
    }, 1800000);
    return;
  }

  if (commandName === "stats") {
    await interaction.deferReply();
    const nick1      = interaction.options.getString("jogador1");
    const nick2      = interaction.options.getString("jogador2");
    const [p1, p2]   = await Promise.all([getPlayer(nick1), getPlayer(nick2)]);
    if (!p1) return interaction.editReply(`❌ **${nick1}** não encontrado.`);
    if (!p2) return interaction.editReply(`❌ **${nick2}** não encontrado.`);
    const c = (v1, v2) => parseFloat(v1) > parseFloat(v2) ? "🟢" : parseFloat(v1) < parseFloat(v2) ? "🔴" : "🟡";
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${p1.nick} vs ${p2.nick}`).setColor(ORANGE)
      .addFields(
        { name: "📊 Stat",  value: "K/D\nHoras\nKills\nVitórias\nHeadshot %\nInventário\nNível Steam", inline: true },
        { name: p1.nick, value: [`${c(p1.kd,p2.kd)} ${p1.kd}`,`${c(p1.hours,p2.hours)} ${p1.hours}h`,`${c(p1.kills,p2.kills)} ${(p1.kills||0).toLocaleString()}`,`${c(p1.wins,p2.wins)} ${(p1.wins||0).toLocaleString()}`,`${c(p1.hs_percent,p2.hs_percent)} ${p1.hs_percent}%`,`${c(p1.inventory_value,p2.inventory_value)} $${(p1.inventory_value||0).toFixed(2)}`,`${c(p1.steam_level,p2.steam_level)} ${p1.steam_level}`].join("\n"), inline: true },
        { name: p2.nick, value: [`${c(p2.kd,p1.kd)} ${p2.kd}`,`${c(p2.hours,p1.hours)} ${p2.hours}h`,`${c(p2.kills,p1.kills)} ${(p2.kills||0).toLocaleString()}`,`${c(p2.wins,p1.wins)} ${(p2.wins||0).toLocaleString()}`,`${c(p2.hs_percent,p1.hs_percent)} ${p2.hs_percent}%`,`${c(p2.inventory_value,p1.inventory_value)} $${(p2.inventory_value||0).toFixed(2)}`,`${c(p2.steam_level,p1.steam_level)} ${p2.steam_level}`].join("\n"), inline: true },
      )
      .setFooter({ text: "🟢 Melhor | 🔴 Pior | 🟡 Empate" }).setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === "top") {
    await interaction.deferReply();
    const cat     = interaction.options.getString("categoria");
    const data    = await fetchJSON(`${SITE_URL}/ranking-api?sort=${cat}&limit=1`);
    const players = data.players || [];
    if (!players.length) return interaction.editReply("Nenhum jogador ainda.");
    const p      = players[0];
    const nomes  = { hours:"Mais Horas", kd:"Melhor K/D", kills:"Mais Kills", wins:"Mais Vitórias", inventory_value:"Inventário Mais Valioso" };
    const vals   = { hours:`${p.hours}h`, kd:p.kd, kills:(p.kills||0).toLocaleString(), wins:(p.wins||0).toLocaleString(), inventory_value:`$${(p.inventory_value||0).toFixed(2)}` };
    const embed  = new EmbedBuilder()
      .setTitle(`🏆 ${nomes[cat]}`).setDescription(`**${p.nick}** lidera com **${vals[cat]}**`)
      .setThumbnail(p.avatar).setColor(ORANGE).setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver perfil").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  if (commandName === "site") {
    const embed = new EmbedBuilder()
      .setTitle("🎮 CS2HUB").setColor(ORANGE)
      .setDescription("Plataforma completa de rankings, perfis e marketplace para CS2.\nFaça login com Steam e apareça no ranking!")
      .addFields(
        { name: "🏠 Home",        value: `[Acessar](${SITE_URL})`,                    inline: true },
        { name: "🏆 Ranking",     value: `[Ver ranking](${SITE_URL}/ranking.html)`,   inline: true },
        { name: "🏪 Marketplace", value: `[Ver itens](${SITE_URL}/marketplace.html)`, inline: true },
        { name: "👤 Meu Perfil",  value: `[Ver perfil](${SITE_URL}/perfil.html)`,     inline: true },
      )
      .setFooter({ text: "Login gratuito com Steam" }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("🎮 CS2HUB").setStyle(ButtonStyle.Link).setURL(SITE_URL),
      new ButtonBuilder().setLabel("🏆 Ranking").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/ranking.html`),
      new ButtonBuilder().setLabel("🏪 Marketplace").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/marketplace.html`),
    );
    return interaction.reply({ embeds: [embed], components: [row] });
  }
});

client.login(TOKEN);
