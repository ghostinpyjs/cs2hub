import {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes,
  ChannelType, PermissionFlagsBits, Events, AuditLogEvent
} from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import http from "http";

// ════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════
const SITE_URL  = process.env.SITE_URL  || "https://cs2hubs.vercel.app";
const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const LOG_CHANNEL_NAME = "📋・bot-logs";

// Paleta visual CS2HUB
const C = {
  ORANGE : 0xf0820f,
  GREEN  : 0x00b894,
  RED    : 0xe74c3c,
  BLUE   : 0x3498db,
  PURPLE : 0x9b59b6,
  GOLD   : 0xf1c40f,
  DARK   : 0x2b2d31,
  TEAL   : 0x1abc9c,
};

if (!TOKEN)     { console.error("❌ DISCORD_TOKEN não definido!");     process.exit(1); }
if (!CLIENT_ID) { console.error("❌ DISCORD_CLIENT_ID não definido!"); process.exit(1); }

// ════════════════════════════════════════════════════════════════════
// BANCO DE DADOS (JSON local)
// ════════════════════════════════════════════════════════════════════
const DB_FILE = "./db.json";
function loadDB() {
  try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch (_) {}
  return { xp: {}, eventCounter: 0 };
}
function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (_) {}
}
const db = loadDB();

// ════════════════════════════════════════════════════════════════════
// SISTEMA DE XP E NÍVEIS
// ════════════════════════════════════════════════════════════════════
const NIVEIS = [
  { nome: "Recruta",  emoji: "🪖", xpMin: 0,    cor: 0x95a5a6 },
  { nome: "Veterano", emoji: "⚔️", xpMin: 500,  cor: 0x27ae60 },
  { nome: "Elite",    emoji: "🔥", xpMin: 1500, cor: 0xe74c3c },
  { nome: "Mestre",   emoji: "💎", xpMin: 3500, cor: 0x3498db },
  { nome: "Lendário", emoji: "👑", xpMin: 7500, cor: 0xf1c40f },
];

const XP = { mensagem: 15, clip: 100, evento: 250, voz_min: 5, steam: 200, quiz: 150, inscricao: 50 };

function getNivel(xp) {
  for (let i = NIVEIS.length - 1; i >= 0; i--)
    if (xp >= NIVEIS[i].xpMin) return { ...NIVEIS[i], index: i };
  return { ...NIVEIS[0], index: 0 };
}
function getProximoNivel(xp) {
  const atual = getNivel(xp);
  return atual.index < NIVEIS.length - 1 ? NIVEIS[atual.index + 1] : null;
}
function getXPUser(id) {
  if (!db.xp[id]) db.xp[id] = { xp: 0, msgs: 0, voz: 0, clips: 0, eventos: 0 };
  return db.xp[id];
}
function barra(atual, max, size = 12) {
  const p = Math.min(Math.round((atual / max) * size), size);
  return "▰".repeat(p) + "▱".repeat(size - p);
}

async function addXP(member, guild, qty) {
  const u = getXPUser(member.id);
  const antes = getNivel(u.xp);
  u.xp += qty;
  saveDB();
  const depois = getNivel(u.xp);
  if (depois.index > antes.index) {
    await aplicarCargoNivel(member, guild, depois);
    return { subiu: true, nivel: depois };
  }
  return { subiu: false };
}

async function aplicarCargoNivel(member, guild, nivel) {
  try {
    for (const n of NIVEIS) {
      const c = guild.roles.cache.find(r => r.name === n.nome);
      if (c && member.roles.cache.has(c.id)) await member.roles.remove(c).catch(() => {});
    }
    let cargo = guild.roles.cache.find(r => r.name === nivel.nome);
    if (!cargo) cargo = await guild.roles.create({ name: nivel.nome, color: nivel.cor, reason: "CS2HUB nível" });
    await member.roles.add(cargo).catch(() => {});
  } catch (e) { console.error("Cargo nível:", e); }
}

// ════════════════════════════════════════════════════════════════════
// CARGOS POR RATING PREMIER
// ════════════════════════════════════════════════════════════════════
const RATINGS = [
  { nome: "Rating 5k+",  min: 5000,  cor: 0x95a5a6 },
  { nome: "Rating 10k+", min: 10000, cor: 0x27ae60  },
  { nome: "Rating 15k+", min: 15000, cor: 0x3498db  },
  { nome: "Rating 20k+", min: 20000, cor: 0x9b59b6  },
  { nome: "Rating 25k+", min: 25000, cor: 0xf1c40f  },
];

async function aplicarCargoRating(member, guild, rating) {
  try {
    for (const r of RATINGS) {
      const c = guild.roles.cache.find(ro => ro.name === r.nome);
      if (c && member.roles.cache.has(c.id)) await member.roles.remove(c).catch(() => {});
    }
    const elegivel = [...RATINGS].reverse().find(r => rating >= r.min);
    if (!elegivel) return null;
    let cargo = guild.roles.cache.find(r => r.name === elegivel.nome);
    if (!cargo) cargo = await guild.roles.create({ name: elegivel.nome, color: elegivel.cor, reason: "CS2HUB rating" });
    await member.roles.add(cargo).catch(() => {});
    return elegivel;
  } catch (e) { console.error("Cargo rating:", e); return null; }
}

// ════════════════════════════════════════════════════════════════════
// SISTEMA DE LOGS
// ════════════════════════════════════════════════════════════════════
async function getLogChannel(guild) {
  let ch = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME && c.type === ChannelType.GuildText);
  if (!ch) {
    try {
      let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === "📊 ┃ CS2HUB");
      if (!cat) cat = await guild.channels.create({ name: "📊 ┃ CS2HUB", type: ChannelType.GuildCategory });
      ch = await guild.channels.create({
        name: LOG_CHANNEL_NAME,
        type: ChannelType.GuildText,
        parent: cat.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
        ],
        topic: "Logs automáticos do CS2HUB Bot",
      });
    } catch (e) { console.error("Criar canal de logs:", e); return null; }
  }
  return ch;
}

async function log(guild, embed) {
  const ch = await getLogChannel(guild);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function logEmbed(titulo, descricao, cor = C.BLUE, fields = []) {
  const e = new EmbedBuilder()
    .setTitle(titulo)
    .setDescription(descricao)
    .setColor(cor)
    .setTimestamp();
  if (fields.length) e.addFields(...fields);
  return e;
}

// ════════════════════════════════════════════════════════════════════
// MAPAS CS2
// ════════════════════════════════════════════════════════════════════
const MAPAS = [
  "Dust2", "Mirage", "Inferno", "Nuke", "Overpass",
  "Ancient", "Anubis", "Vertigo", "Cache", "Train", "Qualquer um",
];

// ════════════════════════════════════════════════════════════════════
// QUIZ
// ════════════════════════════════════════════════════════════════════
const QUIZ = [
  { q: "Qual a pistola padrão do CT?",                    r: "usp",             d: "Começa com U..." },
  { q: "Quantas rodadas tem um mapa regulamentar?",       r: "24",              d: "Número de 2 dígitos..." },
  { q: "Quantos players tem cada time?",                  r: "5",               d: "Número de 1 a 10..." },
  { q: "Qual mapa tem o famoso catwalk?",                 r: "dust2",           d: "Mapa mais clássico do CS..." },
  { q: "Qual é o rifle sniper mais caro do CT?",          r: "awp",             d: "Começa com A, 3 letras..." },
  { q: "Qual é o rifle padrão do terrorista?",            r: "ak47",            d: "Rifle russo famoso..." },
  { q: "Qual pistola poderosa custa $300?",               r: "deagle",          d: "Desert E..." },
  { q: "Em qual site é plantada a bomba em de_inferno?",  r: "a",               d: "Primeira letra do alfabeto..." },
  { q: "O que significa 'clutch'?",                       r: "ganhar sozinho",  d: "Virar o round 1 contra X..." },
  { q: "Qual o nome da faca padrão do CS2?",              r: "faca",            d: "Arma branca padrão..." },
  { q: "Quantos segundos dura a fase de compra?",         r: "20",              d: "Menos de 30 segundos..." },
  { q: "O que é 'peek'?",                                 r: "sair de cobertura", d: "Sair do corner para atirar..." },
];

// ════════════════════════════════════════════════════════════════════
// ESTADO EM MEMÓRIA
// ════════════════════════════════════════════════════════════════════
const grupos      = new Map(); // grupoId → grupo
const eventos     = new Map(); // eventoId → evento
const quizAtivo   = new Map(); // channelId → quiz
const xpCD        = new Map(); // userId → timestamp
const callsAtivas = new Map(); // channelId → { dono, timer, guildId }

// ════════════════════════════════════════════════════════════════════
// COMANDOS SLASH
// ════════════════════════════════════════════════════════════════════
const commands = [

  new SlashCommandBuilder()
    .setName("jogar")
    .setDescription("🎮 Procurar grupo para uma partida — cria sala privada automaticamente!")
    .addStringOption(o => o.setName("modo").setDescription("Modo de jogo").setRequired(true)
      .addChoices(
        { name: "🏆 Premier",     value: "Premier"     },
        { name: "⚔️ Competitivo", value: "Competitivo" },
        { name: "💀 Deathmatch",  value: "Deathmatch"  },
        { name: "🎮 Casual",      value: "Casual"      },
        { name: "🗡️ Wingman",     value: "Wingman"     },
        { name: "🔫 Arms Race",   value: "Arms Race"   },
      ))
    .addStringOption(o => o.setName("mapa").setDescription("Mapa preferido").setRequired(false)
      .addChoices(...MAPAS.map(m => ({ name: m, value: m }))))
    .addIntegerOption(o => o.setName("vagas").setDescription("Quantas vagas? (1–4)").setRequired(false).setMinValue(1).setMaxValue(4))
    .addStringOption(o => o.setName("rank").setDescription("Seu ELO/rank — ex: 12500").setRequired(false))
    .addStringOption(o => o.setName("obs").setDescription("Observações extras").setRequired(false)),

  new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("🏆 Ver top jogadores do CS2HUB")
    .addStringOption(o => o.setName("ordem").setDescription("Ordenar por").setRequired(false)
      .addChoices(
        { name: "⏱ Horas",       value: "hours"           },
        { name: "⚔️ K/D",         value: "kd"              },
        { name: "💀 Kills",       value: "kills"           },
        { name: "🏆 Vitórias",    value: "wins"            },
        { name: "🎮 Nível Steam", value: "steam_level"     },
        { name: "💰 Inventário",  value: "inventory_value" },
      )),

  new SlashCommandBuilder()
    .setName("jogador")
    .setDescription("🔍 Ver perfil completo de um jogador")
    .addStringOption(o => o.setName("nick").setDescription("Nick ou SteamID").setRequired(true)),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("⚔️ Comparar stats de dois jogadores")
    .addStringOption(o => o.setName("jogador1").setDescription("Primeiro jogador").setRequired(true))
    .addStringOption(o => o.setName("jogador2").setDescription("Segundo jogador").setRequired(true)),

  new SlashCommandBuilder()
    .setName("top")
    .setDescription("🥇 Ver o melhor jogador em uma categoria")
    .addStringOption(o => o.setName("categoria").setDescription("Categoria").setRequired(true)
      .addChoices(
        { name: "⏱ Mais horas",           value: "hours"           },
        { name: "⚔️ Melhor K/D",           value: "kd"              },
        { name: "💀 Mais kills",           value: "kills"           },
        { name: "🏆 Mais vitórias",        value: "wins"            },
        { name: "💰 Inventário mais caro", value: "inventory_value" },
      )),

  new SlashCommandBuilder()
    .setName("marketplace")
    .setDescription("🏪 Ver itens CS2 à venda")
    .addIntegerOption(o => o.setName("pagina").setDescription("Página").setRequired(false)),

  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("🧑 Ver perfil de XP e nível no servidor")
    .addUserOption(o => o.setName("usuario").setDescription("Ver perfil de outra pessoa").setRequired(false)),

  new SlashCommandBuilder()
    .setName("rankingxp")
    .setDescription("⭐ Ranking de XP do servidor"),

  new SlashCommandBuilder()
    .setName("conectarsteam")
    .setDescription("🔗 Vincular sua Steam e receber cargo de rating automático")
    .addStringOption(o => o.setName("nick").setDescription("Seu nick no CS2HUB").setRequired(true)),

  new SlashCommandBuilder()
    .setName("evento")
    .setDescription("🎉 Gerenciar eventos da comunidade")
    .addSubcommand(s => s.setName("criar").setDescription("Criar um novo evento")
      .addStringOption(o => o.setName("tipo").setDescription("Tipo").setRequired(true)
        .addChoices(
          { name: "🎮 Mix 5x5",          value: "mix5x5"     },
          { name: "🏆 Campeonato Mensal", value: "campeonato" },
          { name: "🎁 Sorteio de Skins",  value: "sorteio"    },
          { name: "❓ Quiz CS2",          value: "quiz"       },
          { name: "⚔️ X1 da Comunidade",  value: "x1"         },
        ))
      .addStringOption(o => o.setName("descricao").setDescription("Descrição").setRequired(false))
      .addIntegerOption(o => o.setName("vagas").setDescription("Vagas (padrão 10)").setRequired(false).setMinValue(2).setMaxValue(100)))
    .addSubcommand(s => s.setName("lista").setDescription("Ver eventos ativos"))
    .addSubcommand(s => s.setName("encerrar").setDescription("Encerrar evento")
      .addStringOption(o => o.setName("id").setDescription("ID do evento").setRequired(true))),

  new SlashCommandBuilder()
    .setName("quiz")
    .setDescription("❓ Iniciar uma rodada de Quiz CS2"),

  new SlashCommandBuilder()
    .setName("site")
    .setDescription("🌐 Links e informações do CS2HUB"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Ver latência do bot"),

  new SlashCommandBuilder()
    .setName("call")
    .setDescription("🔊 Criar uma call de voz temporária")
    .addStringOption(o => o.setName("nome").setDescription("Nome da call (ex: Dust2 só os bom)").setRequired(false))
    .addIntegerOption(o => o.setName("limite").setDescription("Limite de pessoas (0 = sem limite)").setRequired(false).setMinValue(0).setMaxValue(99))
    .addBooleanOption(o => o.setName("privada").setDescription("Call privada? (só quem foi convidado entra)").setRequired(false)),

].map(c => c.toJSON());

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Comandos registrados!");
  } catch (e) { console.error("❌ Registrar comandos:", e); }
}

async function fetchJSON(url) {
  try { const r = await fetch(url); return await r.json(); }
  catch { return {}; }
}

async function getPlayer(nick) {
  const d = await fetchJSON(`${SITE_URL}/search-api?q=${encodeURIComponent(nick)}`);
  return d.players?.[0] || null;
}

function ratingEmoji(r) {
  if (r >= 25000) return "👑";
  if (r >= 20000) return "💎";
  if (r >= 15000) return "🔵";
  if (r >= 10000) return "🟢";
  if (r >= 5000)  return "🟡";
  return "⚪";
}
function kdEmoji(kd) { return kd >= 1.2 ? "🟢" : kd >= 0.85 ? "🟡" : "🔴"; }

// Rebuild embed do grupo com estado atual
function buildGrupoEmbed(grupo) {
  const total    = grupo.vagas;
  const entrados = grupo.players.length;
  const vagasStr = `${entrados}/${total}`;
  const barraVagas = "🟩".repeat(entrados) + "⬛".repeat(total - entrados);

  const listaMembros = [grupo.leader, ...grupo.players]
    .map((u, i) => `${i === 0 ? "👑" : "👤"} <@${u.id}>`)
    .join("\n");

  const modoIcons = {
    "Premier": "🏆", "Competitivo": "⚔️", "Deathmatch": "💀",
    "Casual": "🎮", "Wingman": "🗡️", "Arms Race": "🔫",
  };
  const modoIcon = modoIcons[grupo.modo] || "🎮";

  return new EmbedBuilder()
    .setTitle(`${modoIcon} Procurando grupo — ${grupo.modo}`)
    .setDescription(
      grupo.obs
        ? `> ${grupo.obs}\n\n**Clique em ✅ Entrar para participar!**`
        : "**Clique em ✅ Entrar para participar!**\nQuando o grupo encher, um canal privado é criado automaticamente."
    )
    .setColor(entrados >= total ? C.GREEN : C.ORANGE)
    .setThumbnail(grupo.leader.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "👑 Líder",       value: `<@${grupo.leader.id}>`, inline: true  },
      { name: "🎯 Modo",        value: grupo.modo,              inline: true  },
      { name: "🗺️ Mapa",        value: grupo.mapa,              inline: true  },
      { name: "📊 Rank/ELO",    value: grupo.rank,              inline: true  },
      { name: `🪑 Vagas ${vagasStr}`, value: barraVagas,        inline: true  },
      { name: "\u200B",         value: "\u200B",                inline: true  },
      { name: `👥 No grupo (${entrados + 1})`, value: listaMembros, inline: false },
    )
    .setFooter({ text: `CS2HUB • ID: ${grupo.id} • Expira em 30 min` })
    .setTimestamp();
}

async function criarCanalGrupo(guild, leader, players, modo, grupoId) {
  try {
    let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === "🎮 | CS2 GRUPOS");
    if (!cat) cat = await guild.channels.create({ name: "🎮 | CS2 GRUPOS", type: ChannelType.GuildCategory });
    const todos = [leader, ...players];
    const canal = await guild.channels.create({
      name: `🎯-${modo.toLowerCase().replace(/ /g, "-")}-${grupoId}`,
      type: ChannelType.GuildText,
      parent: cat.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: leader.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ...players.map(p => ({ id: p.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })),
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
      ],
      topic: `Grupo ${modo} | Líder: ${leader.username} | ${todos.length} jogadores | ID: ${grupoId}`,
    });
    return canal;
  } catch (e) { console.error("Canal grupo:", e); return null; }
}

// ════════════════════════════════════════════════════════════════════
// KEEP-ALIVE HTTP
// ════════════════════════════════════════════════════════════════════
http.createServer((_, res) => res.end("OK")).listen(process.env.PORT || 3000, () => {
  console.log("🌐 Keep-alive HTTP rodando");
});

// ════════════════════════════════════════════════════════════════════
// CLIENT
// ════════════════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ════════════════════════════════════════════════════════════════════
// READY
// ════════════════════════════════════════════════════════════════════
client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} online`);
  await registerCommands();
  client.user.setActivity("CS2HUB | /jogar /ranking /perfil", { type: 0 });

  // XP por voz — tick a cada minuto
  setInterval(() => {
    for (const [, guild] of client.guilds.cache) {
      for (const [, ch] of guild.channels.cache) {
        if (ch.type !== ChannelType.GuildVoice) continue;
        for (const [, member] of ch.members) {
          if (member.user.bot) continue;
          if (member.voice.selfMute && member.voice.selfDeaf) continue;
          const u = getXPUser(member.id);
          u.xp += XP.voz_min;
          u.voz++;
        }
      }
    }
    saveDB();
  }, 60000);
});

// ════════════════════════════════════════════════════════════════════
// LOGS: ENTRADA E SAÍDA DE MEMBROS
// ════════════════════════════════════════════════════════════════════
client.on(Events.GuildMemberAdd, async member => {
  await log(member.guild, logEmbed(
    "📥 Novo membro",
    `<@${member.id}> entrou no servidor`,
    C.GREEN,
    [
      { name: "👤 Usuário",  value: `${member.user.tag}`, inline: true },
      { name: "🆔 ID",       value: member.id,            inline: true },
      { name: "📅 Conta criada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    ]
  ));
});

client.on(Events.GuildMemberRemove, async member => {
  await log(member.guild, logEmbed(
    "📤 Membro saiu",
    `**${member.user.tag}** saiu do servidor`,
    C.RED,
    [
      { name: "👤 Usuário", value: member.user.tag, inline: true },
      { name: "🆔 ID",      value: member.id,       inline: true },
    ]
  ));
});

// ════════════════════════════════════════════════════════════════════
// XP POR MENSAGEM + QUIZ
// ════════════════════════════════════════════════════════════════════
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  const uid = message.author.id;
  const now = Date.now();

  // Anti-spam: cooldown de 1 min
  if (now - (xpCD.get(uid) || 0) >= 60000) {
    xpCD.set(uid, now);
    const u = getXPUser(uid);
    u.msgs++;
    let ganho = XP.mensagem;

    // Clip (vídeo ou imagem)
    if (message.attachments.some(a => a.contentType?.startsWith("video") || a.contentType?.startsWith("image"))) {
      ganho += XP.clip;
      u.clips++;
      await message.react("🎬").catch(() => {});
    }

    const res = await addXP(message.member, message.guild, ganho);
    if (res.subiu) {
      const n = res.nivel;
      const embed = new EmbedBuilder()
        .setTitle(`${n.emoji} LEVEL UP!`)
        .setDescription(`<@${uid}> subiu para o nível **${n.nome}**! 🎉`)
        .setColor(n.cor)
        .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "🏅 Novo nível", value: `${n.emoji} ${n.nome}`, inline: true },
          { name: "⭐ XP total",   value: `${getXPUser(uid).xp.toLocaleString()}`, inline: true },
        )
        .setTimestamp();
      message.channel.send({ embeds: [embed] }).catch(() => {});
      await log(message.guild, logEmbed(
        "⬆️ Level Up",
        `<@${uid}> subiu para **${n.emoji} ${n.nome}**`,
        n.cor,
        [{ name: "⭐ XP", value: `${getXPUser(uid).xp.toLocaleString()}`, inline: true }]
      ));
    }
  }

  // Responder quiz ativo no canal
  const quiz = quizAtivo.get(message.channel.id);
  if (quiz && !quiz.respondido) {
    if (message.content.toLowerCase().includes(quiz.resposta)) {
      quiz.respondido = true;
      const u = getXPUser(uid);
      u.eventos++;
      await addXP(message.member, message.guild, XP.quiz);
      saveDB();
      const embed = new EmbedBuilder()
        .setTitle("✅ Resposta correta!")
        .setDescription(`<@${uid}> acertou e ganhou **${XP.quiz} XP**! 🧠`)
        .setColor(C.GREEN)
        .addFields({ name: "✔️ Resposta", value: quiz.resposta.toUpperCase() })
        .setTimestamp();
      message.channel.send({ embeds: [embed] }).catch(() => {});
      quizAtivo.delete(message.channel.id);
    }
  }
});

// ════════════════════════════════════════════════════════════════════
// INTERACTIONS
// ════════════════════════════════════════════════════════════════════
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // ────────────────────────────────────────
  // BOTÕES
  // ────────────────────────────────────────
  if (interaction.isButton()) {
    const [acao, ...rest] = interaction.customId.split("_");
    const id = rest.join("_");

    // ── Entrar no grupo ──
    if (acao === "entrar") {
      const grupo = grupos.get(id);
      if (!grupo) return interaction.reply({ content: "❌ Grupo não existe mais.", ephemeral: true });
      if (interaction.user.id === grupo.leader.id)
        return interaction.reply({ content: "❌ Você é o líder!", ephemeral: true });
      if (grupo.players.find(p => p.id === interaction.user.id))
        return interaction.reply({ content: "✅ Você já está no grupo!", ephemeral: true });
      if (grupo.players.length >= grupo.vagas)
        return interaction.reply({ content: "❌ Grupo cheio!", ephemeral: true });

      grupo.players.push(interaction.user);

      // Atualizar embed com novos membros
      try {
        const msg = await interaction.channel.messages.fetch(grupo.messageId);
        const novoEmbed = buildGrupoEmbed(grupo);
        const rowAtual = buildGrupoRow(id, grupo);
        await msg.edit({ embeds: [novoEmbed], components: [rowAtual] });
      } catch (_) {}

      await interaction.reply({ content: `✅ **${interaction.user.username}** entrou no grupo! (${grupo.players.length}/${grupo.vagas})` });

      await log(interaction.guild, logEmbed(
        "👥 Jogador entrou no grupo",
        `<@${interaction.user.id}> entrou no grupo **${grupo.modo}** de <@${grupo.leader.id}>`,
        C.GREEN
      ));

      // Grupo cheio → criar canal
      if (grupo.players.length >= grupo.vagas) {
        const canal = await criarCanalGrupo(interaction.guild, grupo.leader, grupo.players, grupo.modo, id);
        if (canal) {
          grupos.delete(id);
          const todos    = [grupo.leader, ...grupo.players];
          const mencoes  = todos.map(p => `<@${p.id}>`).join(" ");
          const embedOk  = new EmbedBuilder()
            .setTitle(`✅ Grupo ${grupo.modo} formado!`)
            .setDescription(`${mencoes}\n\nBom jogo! 🎮`)
            .setColor(C.GREEN)
            .addFields(
              { name: "🎯 Modo",   value: grupo.modo,              inline: true },
              { name: "🗺️ Mapa",   value: grupo.mapa,              inline: true },
              { name: "👥 Total",  value: `${todos.length}`,        inline: true },
              { name: "🔗 Site",   value: `[CS2HUB](${SITE_URL})`, inline: true },
            )
            .setFooter({ text: "Canal fechado automaticamente em 2 horas" })
            .setTimestamp();
          const rowCanal = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fechar_${id}`).setLabel("🗑️ Fechar canal").setStyle(ButtonStyle.Danger),
          );
          await canal.send({ content: mencoes, embeds: [embedOk], components: [rowCanal] });
          setTimeout(() => canal.delete().catch(() => {}), 7200000);
          try {
            const msg = await interaction.channel.messages.fetch(grupo.messageId);
            await msg.edit({
              embeds: [new EmbedBuilder().setTitle("✅ Grupo formado!").setDescription(`Canal criado: ${canal}`).setColor(C.GREEN)],
              components: [],
            });
          } catch (_) {}
          await log(interaction.guild, logEmbed("🎮 Grupo formado", `Grupo **${grupo.modo}** formado por <@${grupo.leader.id}>`, C.GREEN));
        }
      }
      return;
    }

    // ── Sair do grupo ──
    if (acao === "sair") {
      const grupo = grupos.get(id);
      if (!grupo) return interaction.reply({ content: "❌ Grupo não existe mais.", ephemeral: true });
      if (interaction.user.id === grupo.leader.id) {
        grupos.delete(id);
        try {
          const msg = await interaction.channel.messages.fetch(grupo.messageId);
          await msg.edit({
            embeds: [new EmbedBuilder().setTitle("❌ Grupo cancelado").setDescription(`Líder **${grupo.leader.username}** cancelou.`).setColor(C.RED)],
            components: [],
          });
        } catch (_) {}
        await log(interaction.guild, logEmbed("❌ Grupo cancelado", `<@${grupo.leader.id}> cancelou o grupo **${grupo.modo}**`, C.RED));
        return interaction.reply({ content: "✅ Grupo cancelado.", ephemeral: true });
      }
      const idx = grupo.players.findIndex(p => p.id === interaction.user.id);
      if (idx === -1) return interaction.reply({ content: "❌ Você não está no grupo.", ephemeral: true });
      grupo.players.splice(idx, 1);
      try {
        const msg = await interaction.channel.messages.fetch(grupo.messageId);
        await msg.edit({ embeds: [buildGrupoEmbed(grupo)], components: [buildGrupoRow(id, grupo)] });
      } catch (_) {}
      return interaction.reply({ content: `👋 **${interaction.user.username}** saiu do grupo.` });
    }

    // ── Kick do grupo (líder) ──
    if (acao === "kick") {
      const grupo = grupos.get(id);
      if (!grupo) return interaction.reply({ content: "❌ Grupo não existe mais.", ephemeral: true });
      if (interaction.user.id !== grupo.leader.id)
        return interaction.reply({ content: "❌ Só o líder pode remover membros.", ephemeral: true });
      if (!grupo.players.length)
        return interaction.reply({ content: "❌ Não há membros para remover.", ephemeral: true });

      // Remove o último que entrou
      const removido = grupo.players.pop();
      try {
        const msg = await interaction.channel.messages.fetch(grupo.messageId);
        await msg.edit({ embeds: [buildGrupoEmbed(grupo)], components: [buildGrupoRow(id, grupo)] });
      } catch (_) {}
      return interaction.reply({ content: `🦵 **${removido.username}** foi removido do grupo pelo líder.` });
    }

    // ── Fechar canal ──
    if (acao === "fechar") {
      await interaction.reply({ content: "🗑️ Canal fechando em 5 segundos..." });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    // ── Inscrição em evento ──
    if (acao === "insc") {
      const evento = eventos.get(id);
      if (!evento) return interaction.reply({ content: "❌ Evento não encontrado.", ephemeral: true });
      if (evento.inscritos.find(u => u.id === interaction.user.id))
        return interaction.reply({ content: "✅ Você já está inscrito!", ephemeral: true });
      if (evento.inscritos.length >= evento.vagas)
        return interaction.reply({ content: "❌ Evento lotado!", ephemeral: true });

      evento.inscritos.push(interaction.user);
      const u = getXPUser(interaction.user.id);
      u.xp += XP.inscricao;
      u.eventos++;
      saveDB();

      // Atualizar embed do evento
      try {
        const msg = await interaction.channel.messages.fetch(evento.messageId);
        await msg.edit({ embeds: [buildEventoEmbed(evento)] });
      } catch (_) {}

      await interaction.reply({ content: `✅ **${interaction.user.username}** inscrito em **${evento.nome}**! +${XP.inscricao} XP` });

      await log(interaction.guild, logEmbed(
        "🎉 Inscrição em evento",
        `<@${interaction.user.id}> se inscreveu em **${evento.nome}** (${evento.inscritos.length}/${evento.vagas})`,
        C.TEAL
      ));

      if (evento.inscritos.length >= evento.vagas) {
        const mencoes = evento.inscritos.map(u => `<@${u.id}>`).join(" ");
        try {
          const msg = await interaction.channel.messages.fetch(evento.messageId);
          await msg.edit({
            embeds: [new EmbedBuilder().setTitle(`✅ ${evento.nome} — Vagas preenchidas!`).setDescription(mencoes).setColor(C.GREEN).setTimestamp()],
            components: [],
          });
        } catch (_) {}
      }
      return;
    }

    return;
  }

  // ────────────────────────────────────────
  // SLASH COMMANDS
  // ────────────────────────────────────────
  const cmd = interaction.commandName;

  // ── ping ──
  if (cmd === "ping") {
    const ms = Date.now() - interaction.createdTimestamp;
    return interaction.reply(
      `🏓 **Pong!** Latência: \`${ms}ms\` | API WebSocket: \`${client.ws.ping}ms\``
    );
  }

  // ── site ──
  if (cmd === "site") {
    const embed = new EmbedBuilder()
      .setTitle("🎮 CS2HUB")
      .setDescription("Plataforma completa de rankings, perfis e marketplace para CS2.\nLogin gratuito com Steam!")
      .setColor(C.ORANGE)
      .setThumbnail("https://cs2hubs.vercel.app/favicon.ico")
      .addFields(
        { name: "🏠 Home",        value: `[Acessar](${SITE_URL})`,                    inline: true },
        { name: "🏆 Ranking",     value: `[Ver ranking](${SITE_URL}/ranking.html)`,   inline: true },
        { name: "🏪 Marketplace", value: `[Ver itens](${SITE_URL}/marketplace.html)`, inline: true },
        { name: "👤 Meu Perfil",  value: `[Ver perfil](${SITE_URL}/perfil.html)`,     inline: true },
      )
      .setFooter({ text: "CS2HUB • Feito para a comunidade" })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("🎮 CS2HUB").setStyle(ButtonStyle.Link).setURL(SITE_URL),
      new ButtonBuilder().setLabel("🏆 Ranking").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/ranking.html`),
      new ButtonBuilder().setLabel("🏪 Marketplace").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/marketplace.html`),
    );
    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // ── ranking ──
  if (cmd === "ranking") {
    await interaction.deferReply();
    const ordem   = interaction.options.getString("ordem") || "hours";
    const data    = await fetchJSON(`${SITE_URL}/ranking-api?sort=${ordem}&limit=10`);
    const players = data.players || [];
    if (!players.length) return interaction.editReply("Nenhum jogador no ranking ainda.");
    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const labels = { hours:"Horas", kd:"K/D", kills:"Kills", wins:"Vitórias", steam_level:"Nível Steam", inventory_value:"Inventário" };
    const desc = players.map((p, i) =>
      `${medals[i]} **${p.nick}** — \`${p.hours}h\` | K/D: \`${p.kd}\` | Nível: \`${p.steam_level}\``
    ).join("\n");
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top 10 — ${labels[ordem] || "Horas"}`)
      .setDescription(desc)
      .setColor(C.ORANGE)
      .setURL(`${SITE_URL}/ranking.html`)
      .setFooter({ text: `CS2HUB • ${data.total || 0} jogadores cadastrados` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver ranking completo").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/ranking.html`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── jogador ──
  if (cmd === "jogador") {
    await interaction.deferReply();
    const nick = interaction.options.getString("nick");
    const p    = await getPlayer(nick);
    if (!p) return interaction.editReply(`❌ Jogador **${nick}** não encontrado.`);
    const kd     = parseFloat(p.kd) || 0;
    const rating = p.premier_rating || 0;
    const embed  = new EmbedBuilder()
      .setAuthor({ name: "CS2HUB", url: SITE_URL })
      .setTitle(p.nick)
      .setThumbnail(p.avatar)
      .setColor(C.ORANGE)
      .setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`)
      .addFields(
        { name: "⏱ Horas",              value: `\`${p.hours}h\``,                           inline: true },
        { name: `${kdEmoji(kd)} K/D`,   value: `\`${p.kd}\``,                               inline: true },
        { name: "🎮 Nível Steam",        value: `\`${p.steam_level}\``,                      inline: true },
        { name: "💀 Kills",              value: `\`${(p.kills||0).toLocaleString()}\``,       inline: true },
        { name: "🏆 Vitórias",           value: `\`${(p.wins||0).toLocaleString()}\``,        inline: true },
        { name: "🎯 HS%",               value: `\`${p.hs_percent}%\``,                       inline: true },
        { name: "⭐ MVPs",              value: `\`${p.mvps||0}\``,                           inline: true },
        { name: "🔫 Arma fav.",          value: `\`${p.fav_weapon||"N/D"}\``,                inline: true },
        { name: "💰 Inventário",         value: `\`$${(p.inventory_value||0).toFixed(2)}\``, inline: true },
        { name: `${ratingEmoji(rating)} Rating Premier`, value: `\`${rating.toLocaleString()}\``, inline: true },
      )
      .setFooter({ text: `SteamID: ${p.steam_id}` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver perfil").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`),
      new ButtonBuilder().setLabel("Steam").setStyle(ButtonStyle.Link).setURL(p.profile_url || `https://steamcommunity.com/profiles/${p.steam_id}`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── stats ──
  if (cmd === "stats") {
    await interaction.deferReply();
    const [p1, p2] = await Promise.all([
      getPlayer(interaction.options.getString("jogador1")),
      getPlayer(interaction.options.getString("jogador2")),
    ]);
    if (!p1) return interaction.editReply(`❌ **${interaction.options.getString("jogador1")}** não encontrado.`);
    if (!p2) return interaction.editReply(`❌ **${interaction.options.getString("jogador2")}** não encontrado.`);
    const c = (a, b) => parseFloat(a) > parseFloat(b) ? "🟢" : parseFloat(a) < parseFloat(b) ? "🔴" : "🟡";
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${p1.nick}  vs  ${p2.nick}`)
      .setColor(C.ORANGE)
      .addFields(
        { name: "📊 Stat", value: "K/D\nHoras\nKills\nVitórias\nHS%\nInventário\nNível\nRating", inline: true },
        { name: p1.nick, value: [
          `${c(p1.kd, p2.kd)} ${p1.kd}`,
          `${c(p1.hours, p2.hours)} ${p1.hours}h`,
          `${c(p1.kills, p2.kills)} ${(p1.kills||0).toLocaleString()}`,
          `${c(p1.wins, p2.wins)} ${(p1.wins||0).toLocaleString()}`,
          `${c(p1.hs_percent, p2.hs_percent)} ${p1.hs_percent}%`,
          `${c(p1.inventory_value, p2.inventory_value)} $${(p1.inventory_value||0).toFixed(2)}`,
          `${c(p1.steam_level, p2.steam_level)} ${p1.steam_level}`,
          `${c(p1.premier_rating||0, p2.premier_rating||0)} ${(p1.premier_rating||0).toLocaleString()}`,
        ].join("\n"), inline: true },
        { name: p2.nick, value: [
          `${c(p2.kd, p1.kd)} ${p2.kd}`,
          `${c(p2.hours, p1.hours)} ${p2.hours}h`,
          `${c(p2.kills, p1.kills)} ${(p2.kills||0).toLocaleString()}`,
          `${c(p2.wins, p1.wins)} ${(p2.wins||0).toLocaleString()}`,
          `${c(p2.hs_percent, p1.hs_percent)} ${p2.hs_percent}%`,
          `${c(p2.inventory_value, p1.inventory_value)} $${(p2.inventory_value||0).toFixed(2)}`,
          `${c(p2.steam_level, p1.steam_level)} ${p2.steam_level}`,
          `${c(p2.premier_rating||0, p1.premier_rating||0)} ${(p2.premier_rating||0).toLocaleString()}`,
        ].join("\n"), inline: true },
      )
      .setFooter({ text: "🟢 Melhor  |  🔴 Pior  |  🟡 Empate" })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── top ──
  if (cmd === "top") {
    await interaction.deferReply();
    const cat     = interaction.options.getString("categoria");
    const data    = await fetchJSON(`${SITE_URL}/ranking-api?sort=${cat}&limit=1`);
    const players = data.players || [];
    if (!players.length) return interaction.editReply("Nenhum jogador ainda.");
    const p     = players[0];
    const nomes = { hours:"Mais Horas", kd:"Melhor K/D", kills:"Mais Kills", wins:"Mais Vitórias", inventory_value:"Inventário Mais Valioso" };
    const vals  = { hours:`${p.hours}h`, kd:p.kd, kills:(p.kills||0).toLocaleString(), wins:(p.wins||0).toLocaleString(), inventory_value:`$${(p.inventory_value||0).toFixed(2)}` };
    const embed = new EmbedBuilder()
      .setTitle(`🥇 ${nomes[cat]}`)
      .setDescription(`**${p.nick}** lidera com **${vals[cat]}**`)
      .setThumbnail(p.avatar)
      .setColor(C.GOLD)
      .setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`)
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver perfil").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── marketplace ──
  if (cmd === "marketplace") {
    await interaction.deferReply();
    const pagina  = interaction.options.getInteger("pagina") || 1;
    const data    = await fetchJSON(`${SITE_URL}/api/market-list`);
    const ativos  = (data.listings || []).filter(l => l.status === "active");
    const perPage = 5;
    const slice   = ativos.slice((pagina - 1) * perPage, pagina * perPage);
    if (!ativos.length) return interaction.editReply("🏪 Nenhum item à venda no momento.");
    if (!slice.length)  return interaction.editReply(`❌ Página ${pagina} não existe.`);
    const embeds = slice.map(l => {
      const e = new EmbedBuilder().setTitle(l.item_name).setColor(C.ORANGE)
        .addFields(
          { name: "💵 Preço",    value: `$${parseFloat(l.price_usd).toFixed(2)} | R$ ${parseFloat(l.price_brl||l.price_usd*5).toFixed(2)}`, inline: true },
          { name: "👤 Vendedor", value: l.nick || "Jogador", inline: true },
        )
        .setURL(`${SITE_URL}/marketplace.html`);
      if (l.description) e.setDescription(l.description);
      if (l.item_icon)   e.setThumbnail(`https://community.cloudflare.steamstatic.com/economy/image/${l.item_icon}/200fx150f`);
      return e;
    });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver no site").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/marketplace.html`),
    );
    return interaction.editReply({
      content: `🏪 **${ativos.length} itens à venda** • Página ${pagina}/${Math.ceil(ativos.length/perPage)}`,
      embeds, components: [row],
    });
  }

  // ── /jogar (LFG) ──
  if (cmd === "jogar") {
    const modo    = interaction.options.getString("modo");
    const mapa    = interaction.options.getString("mapa")   || "Qualquer um";
    const vagas   = interaction.options.getInteger("vagas") || 1;
    const rank    = interaction.options.getString("rank")   || "Não informado";
    const obs     = interaction.options.getString("obs")    || "";
    const user    = interaction.user;
    const grupoId = Date.now().toString(36);

    const grupo = { id: grupoId, leader: user, players: [], modo, mapa, vagas, rank, obs, messageId: null };
    const embed = buildGrupoEmbed(grupo);
    const row   = buildGrupoRow(grupoId, grupo);

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    grupo.messageId = msg.id;
    grupos.set(grupoId, grupo);

    await log(interaction.guild, logEmbed(
      "🎮 Novo grupo LFG",
      `<@${user.id}> criou grupo **${modo}** no mapa **${mapa}**`,
      C.GREEN,
      [{ name: "🪑 Vagas", value: `${vagas}`, inline: true }]
    ));

    // Expirar em 30 min
    setTimeout(async () => {
      if (!grupos.has(grupoId)) return;
      grupos.delete(grupoId);
      try {
        await msg.edit({
          embeds: [new EmbedBuilder().setTitle("⏰ Grupo expirado").setDescription("O grupo expirou sem ser preenchido.").setColor(C.RED).setTimestamp()],
          components: [],
        });
      } catch (_) {}
    }, 1800000);
    return;
  }

  // ── perfil ──
  if (cmd === "perfil") {
    await interaction.deferReply();
    const alvo = interaction.options.getUser("usuario") || interaction.user;
    const u    = getXPUser(alvo.id);
    const nv   = getNivel(u.xp);
    const prox = getProximoNivel(u.xp);

    const xpNoNivel = u.xp - nv.xpMin;
    const xpRange   = prox ? prox.xpMin - nv.xpMin : 1;
    const xpFalta   = prox ? prox.xpMin - u.xp : 0;
    const barraStr  = prox ? barra(xpNoNivel, xpRange) : "▰".repeat(12);

    const progressoDesc = prox
      ? `**Progresso → ${prox.emoji} ${prox.nome}**\n\`${barraStr}\` ${xpNoNivel}/${xpRange}\n*Faltam **${xpFalta} XP***`
      : `\`${"▰".repeat(12)}\`\n🌟 **Nível máximo atingido!**`;

    const embed = new EmbedBuilder()
      .setAuthor({ name: "CS2HUB • Perfil", url: SITE_URL })
      .setTitle(`${nv.emoji} ${alvo.username}`)
      .setDescription(progressoDesc)
      .setThumbnail(alvo.displayAvatarURL({ size: 256 }))
      .setColor(nv.cor)
      .addFields(
        { name: "🏅 Nível",          value: `${nv.emoji} **${nv.nome}**`,       inline: true },
        { name: "⭐ XP Total",        value: `**${u.xp.toLocaleString()}**`,     inline: true },
        { name: "\u200B",             value: "\u200B",                           inline: true },
        { name: "💬 Mensagens",       value: `\`${u.msgs}\``,                    inline: true },
        { name: "🎬 Clips",           value: `\`${u.clips}\``,                   inline: true },
        { name: "🎙️ Min. em Call",    value: `\`${u.voz}\``,                     inline: true },
        { name: "🎮 Eventos",         value: `\`${u.eventos}\``,                 inline: true },
      )
      .setFooter({ text: "CS2HUB • Sistema de Níveis" })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver no site").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/perfil.html`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── rankingxp ──
  if (cmd === "rankingxp") {
    await interaction.deferReply();
    const sorted = Object.entries(db.xp).sort(([, a], [, b]) => b.xp - a.xp).slice(0, 10);
    if (!sorted.length) return interaction.editReply("Nenhum dado de XP ainda.");
    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const linhas = sorted.map(([uid, d], i) => {
      const n = getNivel(d.xp);
      return `${medals[i]} <@${uid}> — ${n.emoji} **${n.nome}** • \`${d.xp.toLocaleString()} XP\``;
    });
    const embed = new EmbedBuilder()
      .setTitle("⭐ Ranking de XP")
      .setDescription(linhas.join("\n"))
      .setColor(C.GOLD)
      .setFooter({ text: `CS2HUB • Top ${sorted.length} membros` })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── conectarsteam ──
  if (cmd === "conectarsteam") {
    await interaction.deferReply();
    const nick   = interaction.options.getString("nick");
    const player = await getPlayer(nick);
    if (!player) return interaction.editReply(`❌ **${nick}** não encontrado no CS2HUB.\nRegistre-se em: ${SITE_URL}`);

    const rating = player.premier_rating || 0;
    const kd     = parseFloat(player.kd) || 0;
    const hs     = parseFloat(player.hs_percent) || 0;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const cargo  = member ? await aplicarCargoRating(member, interaction.guild, rating) : null;

    const u = getXPUser(interaction.user.id);
    u.xp += XP.steam;
    saveDB();

    const embed = new EmbedBuilder()
      .setAuthor({ name: "CS2HUB • Steam conectado ✅", url: SITE_URL })
      .setTitle(player.nick)
      .setThumbnail(player.avatar)
      .setColor(C.GREEN)
      .addFields(
        { name: `${ratingEmoji(rating)} Rating Premier`, value: `\`${rating.toLocaleString()}\``, inline: true },
        { name: `${kdEmoji(kd)} K/D`,                   value: `\`${kd}\``,                      inline: true },
        { name: "🎯 HS%",                                value: `\`${hs}%\``,                     inline: true },
        { name: "⏱ Horas CS2",                          value: `\`${player.hours}h\``,            inline: true },
        { name: "🏆 Vitórias",                           value: `\`${(player.wins||0).toLocaleString()}\``, inline: true },
        { name: "🎮 Nível Steam",                        value: `\`${player.steam_level}\``,      inline: true },
        { name: "🎁 Bônus XP",       value: `+${XP.steam} XP pelo primeiro login!`, inline: false },
        { name: "🏅 Cargo recebido",  value: cargo ? `**${cargo.nome}**` : "Nenhum (precisa de 5k+ ELO)", inline: false },
      )
      .setFooter({ text: `SteamID: ${player.steam_id}` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver perfil no site").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/jogador.html?id=${player.steam_id}`),
    );

    await log(interaction.guild, logEmbed(
      "🔗 Steam conectado",
      `<@${interaction.user.id}> conectou **${player.nick}** (Rating: ${rating.toLocaleString()})`,
      C.TEAL,
      [{ name: "🏅 Cargo", value: cargo?.nome || "Nenhum", inline: true }]
    ));

    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── evento ──
  if (cmd === "evento") {
    const sub = interaction.options.getSubcommand();

    if (sub === "criar") {
      const tipo     = interaction.options.getString("tipo");
      const desc     = interaction.options.getString("descricao") || "";
      const vagas    = interaction.options.getInteger("vagas") || 10;
      const eventoId = `ev${++db.eventCounter}`;
      saveDB();

      const tipoInfo = {
        mix5x5:     { nome: "🎮 Mix 5x5",          cor: C.GREEN,  desc: "Partidas mixadas 5 contra 5!" },
        campeonato:  { nome: "🏆 Campeonato Mensal", cor: C.GOLD,   desc: "Competição oficial do mês!"   },
        sorteio:     { nome: "🎁 Sorteio de Skins",  cor: C.PURPLE, desc: "Sorteio de skins!"            },
        quiz:        { nome: "❓ Quiz CS2",          cor: C.BLUE,   desc: "Teste seus conhecimentos!"    },
        x1:          { nome: "⚔️ X1 da Comunidade",  cor: C.RED,    desc: "Duelo 1v1 eliminatório!"      },
      };
      const info = tipoInfo[tipo] || { nome: tipo, cor: C.ORANGE, desc: "" };

      const evento = { id: eventoId, tipo, nome: info.nome, vagas, inscritos: [], messageId: null, channelId: interaction.channelId };

      const embed = buildEventoEmbed(evento, desc || info.desc, interaction.user.id);
      const row   = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`insc_${eventoId}`).setLabel("✅ Inscrever-se").setStyle(ButtonStyle.Success),
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      evento.messageId = msg.id;
      eventos.set(eventoId, evento);

      await log(interaction.guild, logEmbed(
        "🎉 Evento criado",
        `<@${interaction.user.id}> criou **${info.nome}** com ${vagas} vagas`,
        info.cor,
        [{ name: "🆔 ID", value: eventoId, inline: true }]
      ));

      // Sorteio automático em 24h
      if (tipo === "sorteio") {
        setTimeout(async () => {
          const ev = eventos.get(eventoId);
          if (!ev || !ev.inscritos.length) return;
          const winner = ev.inscritos[Math.floor(Math.random() * ev.inscritos.length)];
          const ch = client.channels.cache.get(ev.channelId);
          if (ch) {
            const eWinner = new EmbedBuilder()
              .setTitle("🎁 Resultado do Sorteio!")
              .setDescription(`🥳 **Vencedor:** <@${winner.id}>\n\nEntre em contato com o organizador para resgatar!`)
              .setColor(C.GOLD)
              .setThumbnail(winner.displayAvatarURL({ size: 128 }))
              .setTimestamp();
            ch.send({ embeds: [eWinner] }).catch(() => {});
          }
          const mem = await interaction.guild.members.fetch(winner.id).catch(() => null);
          if (mem) await addXP(mem, interaction.guild, XP.evento);
          eventos.delete(eventoId);
        }, 86400000);
      }
      return;
    }

    if (sub === "lista") {
      const ativos = [...eventos.values()];
      if (!ativos.length) return interaction.reply({ content: "📅 Nenhum evento ativo.", ephemeral: true });
      const linhas = ativos.map(e => `• **${e.nome}** — \`${e.inscritos.length}/${e.vagas}\` inscritos • ID: \`${e.id}\``).join("\n");
      const embed  = new EmbedBuilder()
        .setTitle("📅 Eventos Ativos")
        .setDescription(linhas)
        .setColor(C.BLUE)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "encerrar") {
      const eventoId = interaction.options.getString("id");
      if (!eventos.has(eventoId)) return interaction.reply({ content: "❌ Evento não encontrado.", ephemeral: true });
      const ev = eventos.get(eventoId);
      if (interaction.user.id !== ev.organizador && !interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
        return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
      }
      eventos.delete(eventoId);
      await log(interaction.guild, logEmbed("🔴 Evento encerrado", `<@${interaction.user.id}> encerrou **${ev.nome}**`, C.RED));
      return interaction.reply({ content: `✅ Evento **${ev.nome}** encerrado.` });
    }
  }

  // ── quiz ──
  if (cmd === "quiz") {
    if (quizAtivo.has(interaction.channelId))
      return interaction.reply({ content: "❌ Já tem um quiz ativo neste canal!", ephemeral: true });

    const q = QUIZ[Math.floor(Math.random() * QUIZ.length)];
    quizAtivo.set(interaction.channelId, { resposta: q.r, respondido: false });

    const embed = new EmbedBuilder()
      .setTitle("❓ Quiz CS2!")
      .setDescription(`**${q.q}**\n\n> 💡 *Dica: ${q.d}*\n\nDigite a resposta no chat! Primeiro a acertar ganha **${XP.quiz} XP**!`)
      .setColor(C.BLUE)
      .setFooter({ text: "CS2HUB Quiz • 60 segundos!" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    setTimeout(() => {
      const quiz = quizAtivo.get(interaction.channelId);
      if (!quiz || quiz.respondido) return;
      quizAtivo.delete(interaction.channelId);
      const eTimeout = new EmbedBuilder()
        .setTitle("⏰ Tempo esgotado!")
        .setDescription(`Ninguém acertou! A resposta era: **${q.r.toUpperCase()}**`)
        .setColor(C.RED)
        .setTimestamp();
      interaction.channel.send({ embeds: [eTimeout] }).catch(() => {});
    }, 60000);
    return;
  }
});

// ════════════════════════════════════════════════════════════════════
// BUILDERS DE UI
// ════════════════════════════════════════════════════════════════════
function buildGrupoRow(grupoId, grupo) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`entrar_${grupoId}`).setLabel("✅ Entrar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sair_${grupoId}`).setLabel("❌ Sair").setStyle(ButtonStyle.Danger),
  );
  if (grupo.players.length > 0) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`kick_${grupoId}`).setLabel("🦵 Kick").setStyle(ButtonStyle.Secondary),
    );
  }
  return row;
}

function buildEventoEmbed(evento, desc = "", organizadorId = null) {
  const barraVagas = "🟩".repeat(evento.inscritos.length) + "⬛".repeat(Math.max(0, evento.vagas - evento.inscritos.length));
  const listaInscritos = evento.inscritos.length
    ? evento.inscritos.map(u => `• <@${u.id}>`).join("\n")
    : "*Nenhum inscrito ainda*";

  const embed = new EmbedBuilder()
    .setTitle(evento.nome)
    .setDescription(`${desc}\n\n**Inscreva-se para participar!** *(+${XP.inscricao} XP)*`)
    .setColor(C.TEAL)
    .addFields(
      { name: `🪑 Vagas ${evento.inscritos.length}/${evento.vagas}`, value: barraVagas || "⬛", inline: true },
      organizadorId ? { name: "👑 Organizador", value: `<@${organizadorId}>`, inline: true } : { name: "\u200B", value: "\u200B", inline: true },
      { name: "🆔 ID Evento", value: `\`${evento.id}\``, inline: true },
      { name: `👥 Inscritos (${evento.inscritos.length})`, value: listaInscritos, inline: false },
    )
    .setFooter({ text: `CS2HUB Events • ID: ${evento.id}` })
    .setTimestamp();

  return embed;
}

// ════════════════════════════════════════════════════════════════════
// SISTEMA DE CALLS TEMPORÁRIAS
// ════════════════════════════════════════════════════════════════════
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // Alguém SAIU de uma call gerenciada
  if (oldState.channelId && callsAtivas.has(oldState.channelId)) {
    const canal = oldState.channel;
    if (!canal) return;

    // Se ficou vazio, apagar em 10 segundos
    if (canal.members.size === 0) {
      const dados = callsAtivas.get(oldState.channelId);

      // Cancela timer anterior se existir (alguém entrou e saiu rápido)
      if (dados.timer) clearTimeout(dados.timer);

      const timer = setTimeout(async () => {
        // Confirma que ainda está vazio antes de deletar
        const ch = oldState.guild.channels.cache.get(oldState.channelId);
        if (ch && ch.members.size === 0) {
          await ch.delete().catch(() => {});
          callsAtivas.delete(oldState.channelId);
          await log(oldState.guild, logEmbed(
            "🔇 Call deletada",
            `Call temporária **${ch.name}** foi deletada por inatividade`,
            C.RED
          ));
        }
      }, 10000);

      dados.timer = timer;
      callsAtivas.set(oldState.channelId, dados);
    }
  }

  // Alguém ENTROU numa call gerenciada — cancela o timer de deleção
  if (newState.channelId && callsAtivas.has(newState.channelId)) {
    const dados = callsAtivas.get(newState.channelId);
    if (dados.timer) {
      clearTimeout(dados.timer);
      dados.timer = null;
      callsAtivas.set(newState.channelId, dados);
    }
  }
});

// Handler do /call dentro do interactionCreate existente — adicionado via patch
const _origLogin = client.login.bind(client);

// Interceptar o comando /call no interactionCreate já registrado
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "call") return;

  const nome    = interaction.options.getString("nome")    || `🔊 | Call de ${interaction.user.username}`;
  const limite  = interaction.options.getInteger("limite") ?? 0;
  const privada = interaction.options.getBoolean("privada") ?? false;

  // Encontrar ou criar categoria de calls
  let categoria = interaction.guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === "🔊 | CALLS"
  );
  if (!categoria) {
    try {
      categoria = await interaction.guild.channels.create({
        name: "🔊 CALLS",
        type: ChannelType.GuildCategory,
      });
    } catch (e) {
      return interaction.reply({ content: "❌ Sem permissão para criar canais.", ephemeral: true });
    }
  }

  // Permissões base
  const perms = [
    { id: interaction.guild.roles.everyone.id, allow: privada ? [] : [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel], deny: privada ? [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] : [] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers] },
    { id: client.user.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
  ];

  let canal;
  try {
    canal = await interaction.guild.channels.create({
      name: nome,
      type: ChannelType.GuildVoice,
      parent: categoria.id,
      userLimit: limite,
      permissionOverwrites: perms,
    });
  } catch (e) {
    return interaction.reply({ content: "❌ Não consegui criar a call. Verifique as permissões do bot.", ephemeral: true });
  }

  // Registra a call
  callsAtivas.set(canal.id, { dono: interaction.user.id, timer: null, guildId: interaction.guild.id });

  // Embed de resposta
  const embed = new EmbedBuilder()
    .setTitle("🔊 Call criada!")
    .setDescription(`Sua call está pronta! Clique em **Entrar na Call** ou acesse manualmente em **${nome}**.\n\n⚠️ *Se ficar vazia por 10 segundos, será deletada automaticamente.*`)
    .setColor(C.TEAL)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "📛 Nome",      value: `\`${nome}\``,                              inline: true },
      { name: "👥 Limite",    value: limite === 0 ? "Sem limite" : `\`${limite} pessoas\``, inline: true },
      { name: "🔒 Tipo",      value: privada ? "Privada 🔐" : "Pública 🌐",      inline: true },
      { name: "👑 Dono",      value: `<@${interaction.user.id}>`,                inline: true },
      { name: "⏱ Auto-delete", value: "10s sem ninguém",                        inline: true },
    )
    .setFooter({ text: "CS2HUB • Call temporária" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("🔊 Entrar na Call")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${interaction.guild.id}/${canal.id}`),
    new ButtonBuilder()
      .setCustomId(`fecharCall_${canal.id}`)
      .setLabel("🗑️ Deletar call")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row] });

  await log(interaction.guild, logEmbed(
    "🔊 Call criada",
    `<@${interaction.user.id}> criou a call **${nome}**`,
    C.TEAL,
    [
      { name: "👥 Limite",  value: limite === 0 ? "Sem limite" : `${limite}`, inline: true },
      { name: "🔒 Privada", value: privada ? "Sim" : "Não",                   inline: true },
    ]
  ));
});

// Botão de fechar call manualmente
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("fecharCall_")) return;

  const channelId = interaction.customId.replace("fecharCall_", "");
  const dados     = callsAtivas.get(channelId);

  // Só o dono pode deletar pelo botão
  if (dados && interaction.user.id !== dados.dono) {
    return interaction.reply({ content: "❌ Só o dono da call pode deletá-la.", ephemeral: true });
  }

  const canal = interaction.guild.channels.cache.get(channelId);
  if (canal) {
    await canal.delete().catch(() => {});
    callsAtivas.delete(channelId);
    await log(interaction.guild, logEmbed(
      "🗑️ Call deletada manualmente",
      `<@${interaction.user.id}> deletou a call **${canal.name}**`,
      C.RED
    ));
  }

  // Editar mensagem original
  try {
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setTitle("🗑️ Call encerrada")
        .setDescription("A call foi deletada pelo dono.")
        .setColor(C.RED)
        .setTimestamp()],
      components: [],
    });
  } catch (_) {
    await interaction.reply({ content: "✅ Call deletada.", ephemeral: true }).catch(() => {});
  }
});

// ════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════
client.login(TOKEN);
