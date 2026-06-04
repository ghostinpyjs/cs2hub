import {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes,
  ChannelType, PermissionFlagsBits, Events
} from "discord.js";
import fetch from "node-fetch";
import fs from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────
const SITE_URL  = process.env.SITE_URL  || "https://cs2hubs.vercel.app";
const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const ORANGE    = 0xf0820f;
const GREEN     = 0x00b894;
const RED       = 0xe74c3c;
const BLUE      = 0x3498db;
const PURPLE    = 0x9b59b6;
const GOLD      = 0xf1c40f;

if (!TOKEN)     { console.error("❌ DISCORD_TOKEN não definido!");     process.exit(1); }
if (!CLIENT_ID) { console.error("❌ DISCORD_CLIENT_ID não definido!"); process.exit(1); }

// ─── Persistência em JSON (simples, sem banco de dados) ───────────────────────
const DB_FILE = "./db.json";

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (_) {}
  return { xp: {}, eventos: [], eventCounter: 0 };
}

function saveDB(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (_) {}
}

const db = loadDB();

// ─── Sistema de XP e Níveis ────────────────────────────────────────────────
const NIVEIS = [
  { nome: "Recruta",   emoji: "🪖", xpMin: 0     },
  { nome: "Veterano",  emoji: "⚔️",  xpMin: 500   },
  { nome: "Elite",     emoji: "🔥", xpMin: 1500  },
  { nome: "Mestre",    emoji: "💎", xpMin: 3500  },
  { nome: "Lendário",  emoji: "👑", xpMin: 7500  },
];

const XP_RECOMPENSAS = {
  mensagem: 15,
  clip:     100,
  evento:   250,
  voz_min:  5,     // por minuto em call
};

function getNivel(xp) {
  for (let i = NIVEIS.length - 1; i >= 0; i--) {
    if (xp >= NIVEIS[i].xpMin) return { ...NIVEIS[i], index: i };
  }
  return { ...NIVEIS[0], index: 0 };
}

function getNextNivel(xp) {
  const atual = getNivel(xp);
  if (atual.index >= NIVEIS.length - 1) return null;
  return NIVEIS[atual.index + 1];
}

function getXPUser(userId) {
  if (!db.xp[userId]) db.xp[userId] = { xp: 0, mensagens: 0, lastMsg: 0, voz: 0, clips: 0, eventos: 0 };
  return db.xp[userId];
}

async function addXP(member, guild, quantidade, motivo = "") {
  const userData = getXPUser(member.id);
  const nivelAntes = getNivel(userData.xp);
  userData.xp += quantidade;
  saveDB(db);

  const nivelDepois = getNivel(userData.xp);
  if (nivelDepois.index > nivelAntes.index) {
    await aplicarCargoNivel(member, guild, nivelDepois);
    return { subiu: true, nivel: nivelDepois };
  }
  return { subiu: false };
}

async function aplicarCargoNivel(member, guild, nivel) {
  try {
    for (const n of NIVEIS) {
      const cargo = guild.roles.cache.find(r => r.name === n.nome);
      if (cargo && member.roles.cache.has(cargo.id)) {
        await member.roles.remove(cargo).catch(() => {});
      }
    }
    let cargo = guild.roles.cache.find(r => r.name === nivel.nome);
    if (!cargo) {
      const cores = [0x95a5a6, 0x27ae60, 0xe74c3c, 0x3498db, 0xf1c40f];
      cargo = await guild.roles.create({ name: nivel.nome, color: cores[nivel.index], reason: "Cargo de nível CS2HUB" });
    }
    await member.roles.add(cargo).catch(() => {});
  } catch (err) {
    console.error("Erro ao aplicar cargo de nível:", err);
  }
}

// ─── Cargos por Rating CS2 ─────────────────────────────────────────────────
const RATING_CARGOS = [
  { nome: "Rating 5k+",  min: 5000,  cor: 0x95a5a6 },
  { nome: "Rating 10k+", min: 10000, cor: 0x27ae60  },
  { nome: "Rating 15k+", min: 15000, cor: 0x3498db  },
  { nome: "Rating 20k+", min: 20000, cor: 0x9b59b6  },
  { nome: "Rating 25k+", min: 25000, cor: 0xf1c40f  },
];

async function aplicarCargoRating(member, guild, rating) {
  try {
    for (const rc of RATING_CARGOS) {
      const cargo = guild.roles.cache.find(r => r.name === rc.nome);
      if (cargo && member.roles.cache.has(cargo.id)) {
        await member.roles.remove(cargo).catch(() => {});
      }
    }
    const elegivel = [...RATING_CARGOS].reverse().find(rc => rating >= rc.min);
    if (!elegivel) return null;
    let cargo = guild.roles.cache.find(r => r.name === elegivel.nome);
    if (!cargo) {
      cargo = await guild.roles.create({ name: elegivel.nome, color: elegivel.cor, reason: "Cargo de rating CS2" });
    }
    await member.roles.add(cargo).catch(() => {});
    return elegivel;
  } catch (err) {
    console.error("Erro ao aplicar cargo de rating:", err);
    return null;
  }
}

// ─── Cooldown anti-spam de XP ─────────────────────────────────────────────
const xpCooldowns = new Map();
const VOZ_INTERVALS = new Map();

// ─── Grupos ativos ───────────────────────────────────────────────────────────
const gruposAtivos = new Map();

// ─── Eventos ativos ──────────────────────────────────────────────────────────
const eventosAtivos = new Map();

// ─── Quiz CS2 ─────────────────────────────────────────────────────────────
const PERGUNTAS_QUIZ = [
  { pergunta: "Qual é o nome da pistola padrão do CT?", resposta: "usp", dica: "Começa com U..." },
  { pergunta: "Quantas rodadas tem um mapa de CS2 (regulamentar)?", resposta: "24", dica: "Dígito de 2 números..." },
  { pergunta: "Qual é a granadas de smoke mais usada no dust2 no mid?", resposta: "granada de fumaça", dica: "Tipo de granada..." },
  { pergunta: "Quantos players tem cada time em CS2?", resposta: "5", dica: "Número entre 1 e 10..." },
  { pergunta: "Qual mapa tem o famoso 'catwalk'?", resposta: "dust2", dica: "É um dos mapas mais clássicos do CS..." },
  { pergunta: "Qual é o rifle sniper mais caro do CT?", resposta: "awp", dica: "Começa com A..." },
  { pergunta: "O que é 'eco round'?", resposta: "rodada economica", dica: "Relacionado a dinheiro..." },
  { pergunta: "Qual é o rifle padrão do terrorista?", resposta: "ak47", dica: "Nome de um famoso rifle russo..." },
  { pergunta: "Qual arma custa $300 e é muito usada em eco?", resposta: "deagle", dica: "É uma pistola poderosa..." },
  { pergunta: "Em qual site a bomba é plantada em de_inferno?", resposta: "a", dica: "Letra do alfabeto..." },
];

// ─── Comandos ─────────────────────────────────────────────────────────────────
const commands = [
  // Comandos existentes
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

  // ── Novos comandos ──

  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Ver seu perfil de XP e nível no servidor")
    .addUserOption(o => o.setName("usuario").setDescription("Ver perfil de outro usuário").setRequired(false)),

  new SlashCommandBuilder()
    .setName("rankingxp")
    .setDescription("Ver ranking de XP do servidor"),

  new SlashCommandBuilder()
    .setName("conectarsteam")
    .setDescription("Registrar sua conta Steam e obter cargo de rating")
    .addStringOption(o => o.setName("nick").setDescription("Seu nick no CS2HUB / Steam").setRequired(true)),

  new SlashCommandBuilder()
    .setName("evento")
    .setDescription("Gerenciar eventos da comunidade")
    .addSubcommand(s => s.setName("criar").setDescription("Criar um novo evento")
      .addStringOption(o => o.setName("tipo").setDescription("Tipo de evento").setRequired(true)
        .addChoices(
          { name: "🎮 Mix 5x5",           value: "mix5x5" },
          { name: "🏆 Campeonato Mensal",  value: "campeonato" },
          { name: "🎁 Sorteio de Skins",   value: "sorteio" },
          { name: "❓ Quiz CS2",           value: "quiz" },
          { name: "⚔️ X1 da Comunidade",   value: "x1" },
        ))
      .addStringOption(o => o.setName("descricao").setDescription("Descrição do evento").setRequired(false))
      .addIntegerOption(o => o.setName("vagas").setDescription("Vagas máximas (padrão: 10)").setRequired(false).setMinValue(2).setMaxValue(100)))
    .addSubcommand(s => s.setName("lista").setDescription("Ver eventos ativos"))
    .addSubcommand(s => s.setName("encerrar").setDescription("Encerrar um evento (admin)")
      .addStringOption(o => o.setName("id").setDescription("ID do evento").setRequired(true))),

  new SlashCommandBuilder()
    .setName("quiz")
    .setDescription("Iniciar uma rodada de Quiz CS2 no canal"),

  new SlashCommandBuilder()
    .setName("darxp")
    .setDescription("[ADMIN] Dar XP a um usuário")
    .addUserOption(o => o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o => o.setName("quantidade").setDescription("Quantidade de XP").setRequired(true).setMinValue(1).setMaxValue(10000))
    .addStringOption(o => o.setName("motivo").setDescription("Motivo").setRequired(false)),

].map(c => c.toJSON());

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function barraProgresso(atual, maximo, tamanho = 10) {
  const preenchido = Math.round((atual / maximo) * tamanho);
  return "█".repeat(preenchido) + "░".repeat(tamanho - preenchido);
}

// ─── Keep-alive HTTP ──────────────────────────────────────────────────────────
import http from "http";
http.createServer((_, res) => res.end("OK")).listen(process.env.PORT || 3000, () => {
  console.log("🌐 Keep-alive HTTP rodando");
});

// ─── Client ────────────────────────────────────────────────────────────────────
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

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  await registerCommands();
  client.user.setActivity("CS2HUB | /lfg /ranking /perfil", { type: 0 });

  // Contador de XP por voz — tick a cada 1 minuto
  setInterval(async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      for (const [channelId, channel] of guild.channels.cache) {
        if (channel.type !== ChannelType.GuildVoice) continue;
        for (const [memberId, member] of channel.members) {
          if (member.user.bot) continue;
          if (member.voice.selfMute && member.voice.selfDeaf) continue; // não conta mudo+surdo
          const userData = getXPUser(memberId);
          userData.xp   += XP_RECOMPENSAS.voz_min;
          userData.voz  += 1;
          saveDB(db);
        }
      }
    }
  }, 60000);
});

// ─── XP por mensagem ──────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;
  const now    = Date.now();
  const last   = xpCooldowns.get(userId) || 0;

  if (now - last < 60000) return; // 1 mensagem por minuto conta XP
  xpCooldowns.set(userId, now);

  const userData = getXPUser(userId);
  userData.mensagens++;

  // Detecta clips (anexos de vídeo/imagem)
  let xpGanho = XP_RECOMPENSAS.mensagem;
  if (message.attachments.some(a => a.contentType?.startsWith("video") || a.contentType?.startsWith("image"))) {
    xpGanho += XP_RECOMPENSAS.clip;
    userData.clips++;
    await message.react("🎬").catch(() => {});
  }

  const resultado = await addXP(message.member, message.guild, xpGanho);

  if (resultado.subiu) {
    const n = resultado.nivel;
    const embed = new EmbedBuilder()
      .setTitle(`${n.emoji} Level Up!`)
      .setDescription(`Parabéns <@${userId}>! Você subiu para **${n.nome}**!`)
      .setColor(GOLD)
      .addFields({ name: "🏅 Novo nível", value: `${n.emoji} ${n.nome}`, inline: true },
                 { name: "⭐ XP total",   value: `${getXPUser(userId).xp}`, inline: true })
      .setThumbnail(message.author.displayAvatarURL())
      .setTimestamp();
    message.channel.send({ embeds: [embed] }).catch(() => {});
  }

  // Responder quiz ativo no canal
  const quiz = [...eventosAtivos.values()].find(e => e.tipo === "quiz_rodada" && e.channelId === message.channel.id && e.ativo);
  if (quiz && !quiz.respondido) {
    const resposta = message.content.toLowerCase().trim();
    if (resposta.includes(quiz.pergunta.resposta)) {
      quiz.respondido = true;
      const xpQuiz = 150;
      await addXP(message.member, message.guild, xpQuiz);
      const userData2 = getXPUser(userId);
      userData2.eventos++;
      saveDB(db);
      const embed = new EmbedBuilder()
        .setTitle("✅ Resposta correta!")
        .setDescription(`<@${userId}> acertou e ganhou **${xpQuiz} XP**!`)
        .setColor(GREEN)
        .addFields({ name: "✔️ Resposta", value: quiz.pergunta.resposta.toUpperCase() })
        .setTimestamp();
      message.channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // ══════════ BOTÕES ══════════
  if (interaction.isButton()) {
    const parts  = interaction.customId.split("_");
    const acao   = parts[0];
    const extraId = parts.slice(1).join("_");

    // ── Entrar/Sair em Grupo LFG ──
    if (acao === "entrar" || acao === "sair") {
      const grupoId = extraId;
      const grupo   = gruposAtivos.get(grupoId);
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
            const todos   = [grupo.leader, ...grupo.players];
            const mencoes = todos.map(p => `<@${p.id}>`).join(" ");
            const embedOk = new EmbedBuilder()
              .setTitle(`🎮 Grupo ${grupo.modo} formado!`)
              .setDescription(`${mencoes}\n\nSeu grupo está pronto!`)
              .setColor(GREEN)
              .addFields(
                { name: "🎯 Modo",      value: grupo.modo,              inline: true },
                { name: "👥 Jogadores", value: `${todos.length}`,       inline: true },
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
    }

    if (acao === "fechar") {
      await interaction.reply({ content: "🗑️ Fechando canal em 5 segundos..." });
      setTimeout(async () => { try { await interaction.channel.delete(); } catch (_) {} }, 5000);
      return;
    }

    // ── Inscrição em evento ──
    if (acao === "inscreverevent") {
      const eventoId = extraId;
      const evento   = eventosAtivos.get(eventoId);
      if (!evento) return interaction.reply({ content: "❌ Evento não encontrado.", ephemeral: true });
      if (evento.inscritos.find(u => u.id === interaction.user.id))
        return interaction.reply({ content: "✅ Você já está inscrito!", ephemeral: true });
      if (evento.inscritos.length >= evento.vagas)
        return interaction.reply({ content: "❌ Evento lotado!", ephemeral: true });

      evento.inscritos.push(interaction.user);
      eventosAtivos.set(eventoId, evento);

      const userData = getXPUser(interaction.user.id);
      userData.xp     += 50;
      userData.eventos++;
      saveDB(db);

      await interaction.reply({ content: `✅ **${interaction.user.username}** se inscreveu no evento **${evento.nome}**! (+50 XP)` });

      if (evento.inscritos.length >= evento.vagas) {
        const mencoes = evento.inscritos.map(u => `<@${u.id}>`).join(" ");
        try {
          const msg = await interaction.channel.messages.fetch(evento.messageId);
          await msg.edit({
            embeds: [new EmbedBuilder()
              .setTitle(`✅ ${evento.nome} — Vagas preenchidas!`)
              .setDescription(`Participantes: ${mencoes}`)
              .setColor(GREEN).setTimestamp()],
            components: []
          });
        } catch (_) {}
      }
      return;
    }

    return;
  }

  // ══════════ SLASH COMMANDS ══════════
  const { commandName } = interaction;

  // ── ping ──
  if (commandName === "ping") {
    const ms = Date.now() - interaction.createdTimestamp;
    return interaction.reply(`🏓 Pong! Latência: **${ms}ms** | API: **${client.ws.ping}ms**`);
  }

  // ── ranking ──
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

  // ── jogador ──
  if (commandName === "jogador") {
    await interaction.deferReply();
    const nick = interaction.options.getString("nick");
    const p    = await getPlayer(nick);
    if (!p) return interaction.editReply(`❌ Jogador **${nick}** não encontrado.`);
    const kdVal   = parseFloat(p.kd) || 0;
    const kdEmoji = kdVal >= 1.2 ? "🟢" : kdVal >= 0.85 ? "🟡" : "🔴";
    const ratingEmoji = p.premier_rating >= 20000 ? "👑" : p.premier_rating >= 15000 ? "💎" : p.premier_rating >= 10000 ? "🔵" : p.premier_rating >= 5000 ? "🟢" : "⚪";
    const embed   = new EmbedBuilder()
      .setTitle(p.nick).setThumbnail(p.avatar).setColor(ORANGE)
      .setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`)
      .addFields(
        { name: "⏱ Horas CS2",        value: `${p.hours}h`,                           inline: true },
        { name: `${kdEmoji} K/D`,      value: `${p.kd}`,                               inline: true },
        { name: "🎮 Nível Steam",      value: `${p.steam_level}`,                      inline: true },
        { name: "💀 Kills",            value: `${(p.kills||0).toLocaleString()}`,       inline: true },
        { name: "🏆 Vitórias",         value: `${(p.wins||0).toLocaleString()}`,        inline: true },
        { name: "🎯 Headshot %",       value: `${p.hs_percent}%`,                       inline: true },
        { name: "⭐ MVPs",             value: `${p.mvps||0}`,                           inline: true },
        { name: "🔫 Arma Favorita",    value: `${p.fav_weapon||"N/D"}`,                inline: true },
        { name: "💰 Inventário",       value: `$${(p.inventory_value||0).toFixed(2)}`, inline: true },
        { name: `${ratingEmoji} Rating Premier`, value: `${(p.premier_rating||0).toLocaleString()}`, inline: true },
      )
      .setFooter({ text: `SteamID: ${p.steam_id}` }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver perfil").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/jogador.html?id=${p.steam_id}`),
      new ButtonBuilder().setLabel("Perfil Steam").setStyle(ButtonStyle.Link).setURL(p.profile_url || `https://steamcommunity.com/profiles/${p.steam_id}`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── marketplace ──
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

  // ── lfg ──
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

  // ── stats ──
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
        { name: "📊 Stat",  value: "K/D\nHoras\nKills\nVitórias\nHeadshot %\nInventário\nNível Steam\nRating", inline: true },
        { name: p1.nick, value: [
          `${c(p1.kd,p2.kd)} ${p1.kd}`,
          `${c(p1.hours,p2.hours)} ${p1.hours}h`,
          `${c(p1.kills,p2.kills)} ${(p1.kills||0).toLocaleString()}`,
          `${c(p1.wins,p2.wins)} ${(p1.wins||0).toLocaleString()}`,
          `${c(p1.hs_percent,p2.hs_percent)} ${p1.hs_percent}%`,
          `${c(p1.inventory_value,p2.inventory_value)} $${(p1.inventory_value||0).toFixed(2)}`,
          `${c(p1.steam_level,p2.steam_level)} ${p1.steam_level}`,
          `${c(p1.premier_rating||0,p2.premier_rating||0)} ${(p1.premier_rating||0).toLocaleString()}`,
        ].join("\n"), inline: true },
        { name: p2.nick, value: [
          `${c(p2.kd,p1.kd)} ${p2.kd}`,
          `${c(p2.hours,p1.hours)} ${p2.hours}h`,
          `${c(p2.kills,p1.kills)} ${(p2.kills||0).toLocaleString()}`,
          `${c(p2.wins,p1.wins)} ${(p2.wins||0).toLocaleString()}`,
          `${c(p2.hs_percent,p1.hs_percent)} ${p2.hs_percent}%`,
          `${c(p2.inventory_value,p1.inventory_value)} $${(p2.inventory_value||0).toFixed(2)}`,
          `${c(p2.steam_level,p1.steam_level)} ${p2.steam_level}`,
          `${c(p2.premier_rating||0,p1.premier_rating||0)} ${(p2.premier_rating||0).toLocaleString()}`,
        ].join("\n"), inline: true },
      )
      .setFooter({ text: "🟢 Melhor | 🔴 Pior | 🟡 Empate" }).setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── top ──
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

  // ── site ──
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

  // ════════════════════════════════════════════════════════════
  // NOVOS COMANDOS
  // ════════════════════════════════════════════════════════════

  // ── perfil XP ──
  if (commandName === "perfil") {
    await interaction.deferReply();
    const alvo     = interaction.options.getUser("usuario") || interaction.user;
    const userData = getXPUser(alvo.id);
    const nivel    = getNivel(userData.xp);
    const proximo  = getNextNivel(userData.xp);
    const member   = await interaction.guild.members.fetch(alvo.id).catch(() => null);

    const xpParaProximo = proximo ? proximo.xpMin - userData.xp : 0;
    const xpNoNivel     = proximo ? userData.xp - nivel.xpMin : userData.xp - nivel.xpMin;
    const xpRange       = proximo ? proximo.xpMin - nivel.xpMin : 1;
    const barra         = proximo ? barraProgresso(xpNoNivel, xpRange, 12) : "█".repeat(12);

    const embed = new EmbedBuilder()
      .setTitle(`${nivel.emoji} Perfil — ${alvo.username}`)
      .setThumbnail(alvo.displayAvatarURL())
      .setColor(PURPLE)
      .addFields(
        { name: "🏅 Nível",          value: `${nivel.emoji} **${nivel.nome}**`,    inline: true },
        { name: "⭐ XP Total",        value: `**${userData.xp.toLocaleString()}**`, inline: true },
        { name: "📨 Mensagens",       value: `${userData.mensagens}`,               inline: true },
        { name: "🎬 Clips enviados",  value: `${userData.clips}`,                   inline: true },
        { name: "🎙️ Min. em Call",    value: `${userData.voz}`,                     inline: true },
        { name: "🎮 Eventos",         value: `${userData.eventos}`,                 inline: true },
      )
      .setDescription(
        proximo
          ? `**Progresso para ${proximo.emoji} ${proximo.nome}:**\n\`${barra}\` ${xpNoNivel}/${xpRange} XP\n\n*Faltam **${xpParaProximo} XP** para o próximo nível!*`
          : `\`${barra}\`\n\n🌟 *Nível máximo atingido!*`
      )
      .setFooter({ text: "CS2HUB • Sistema de Níveis" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver no site").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/perfil.html`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── ranking XP do servidor ──
  if (commandName === "rankingxp") {
    await interaction.deferReply();
    const sorted = Object.entries(db.xp)
      .sort(([, a], [, b]) => b.xp - a.xp)
      .slice(0, 10);

    if (!sorted.length) return interaction.editReply("Nenhum dado de XP ainda.");

    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const linhas = sorted.map(([uid, d], i) => {
      const n = getNivel(d.xp);
      return `${medals[i]} <@${uid}> — ${n.emoji} **${n.nome}** • ${d.xp.toLocaleString()} XP`;
    });

    const embed = new EmbedBuilder()
      .setTitle("⭐ Ranking de XP do Servidor")
      .setDescription(linhas.join("\n"))
      .setColor(GOLD)
      .setFooter({ text: `CS2HUB • ${sorted.length} jogadores` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ── conectar Steam ──
  if (commandName === "conectarsteam") {
    await interaction.deferReply();
    const nick   = interaction.options.getString("nick");
    const player = await getPlayer(nick);
    if (!player) return interaction.editReply(`❌ Jogador **${nick}** não encontrado no CS2HUB. Certifique-se de estar registrado em ${SITE_URL}`);

    const rating  = player.premier_rating || 0;
    const kd      = parseFloat(player.kd) || 0;
    const hs      = parseFloat(player.hs_percent) || 0;
    const member  = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    const cargoCriado = member ? await aplicarCargoRating(member, interaction.guild, rating) : null;
    const ratingEmoji = rating >= 25000 ? "👑" : rating >= 20000 ? "💎" : rating >= 15000 ? "🔵" : rating >= 10000 ? "🟢" : rating >= 5000 ? "🟡" : "⚪";

    // Dar XP bônus por conectar Steam
    const userData = getXPUser(interaction.user.id);
    userData.xp += 200;
    saveDB(db);

    const embed = new EmbedBuilder()
      .setTitle("🔗 Steam conectado com sucesso!")
      .setThumbnail(player.avatar)
      .setColor(GREEN)
      .addFields(
        { name: "👤 Nick",               value: player.nick,                                    inline: true },
        { name: `${ratingEmoji} Rating`,  value: `${rating.toLocaleString()}`,                  inline: true },
        { name: "⚔️ K/D",                value: `${kd}`,                                        inline: true },
        { name: "🎯 Headshot %",          value: `${hs}%`,                                       inline: true },
        { name: "⏱ Horas CS2",           value: `${player.hours}h`,                             inline: true },
        { name: "🏆 Vitórias",            value: `${(player.wins||0).toLocaleString()}`,          inline: true },
        { name: "🎁 Bônus XP",           value: "+200 XP por conectar a Steam!",                inline: false },
        { name: "🏅 Cargo recebido",      value: cargoCriado ? `**${cargoCriado.nome}**` : "Ainda sem cargo de rating (precisa de 5k+ ELO)", inline: false },
      )
      .setFooter({ text: `SteamID: ${player.steam_id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ver perfil no site").setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/jogador.html?id=${player.steam_id}`),
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── eventos ──
  if (commandName === "evento") {
    const sub = interaction.options.getSubcommand();

    if (sub === "criar") {
      const tipo      = interaction.options.getString("tipo");
      const descricao = interaction.options.getString("descricao") || "";
      const vagas     = interaction.options.getInteger("vagas") || 10;
      const eventoId  = `ev${++db.eventCounter}`;
      saveDB(db);

      const tipoInfo = {
        mix5x5:     { nome: "🎮 Mix 5x5",          cor: GREEN,  desc: "Partidas mixadas 5 contra 5!" },
        campeonato:  { nome: "🏆 Campeonato Mensal", cor: GOLD,   desc: "Competição oficial do mês!" },
        sorteio:     { nome: "🎁 Sorteio de Skins",  cor: PURPLE, desc: "Sorteio de skins da comunidade!" },
        quiz:        { nome: "❓ Quiz CS2",          cor: BLUE,   desc: "Teste seus conhecimentos sobre CS2!" },
        x1:          { nome: "⚔️ X1 da Comunidade",  cor: RED,    desc: "Duelo 1v1 eliminatório!" },
      };
      const info = tipoInfo[tipo] || { nome: tipo, cor: ORANGE, desc: "" };

      const embed = new EmbedBuilder()
        .setTitle(info.nome)
        .setDescription(`${descricao || info.desc}\n\n**Clique em Inscrever-se para participar!**\n*+50 XP ao se inscrever*`)
        .setColor(info.cor)
        .addFields(
          { name: "👥 Vagas",      value: `0/${vagas}`,                    inline: true },
          { name: "👑 Organizador", value: `<@${interaction.user.id}>`,    inline: true },
          { name: "🆔 ID Evento",  value: eventoId,                        inline: true },
        )
        .setFooter({ text: `CS2HUB Events • ID: ${eventoId}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`inscreverevent_${eventoId}`).setLabel("✅ Inscrever-se").setStyle(ButtonStyle.Success),
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      eventosAtivos.set(eventoId, {
        id: eventoId, tipo, nome: info.nome, vagas,
        inscritos: [], messageId: msg.id,
        organizador: interaction.user.id,
        channelId: interaction.channelId,
      });

      // Se for sorteio, agenda resultado em 24h
      if (tipo === "sorteio") {
        setTimeout(async () => {
          const evento = eventosAtivos.get(eventoId);
          if (!evento || !evento.inscritos.length) return;
          const vencedor = evento.inscritos[Math.floor(Math.random() * evento.inscritos.length)];
          const ch = interaction.channel;
          if (!ch) return;
          const embedSorteio = new EmbedBuilder()
            .setTitle("🎁 Resultado do Sorteio!")
            .setDescription(`🥳 O vencedor é <@${vencedor.id}>!\n\nEntre em contato com o organizador para resgatar o prêmio.`)
            .setColor(GOLD)
            .setThumbnail(vencedor.displayAvatarURL())
            .setTimestamp();
          ch.send({ embeds: [embedSorteio] }).catch(() => {});
          // Dar XP ao vencedor
          const mem = await interaction.guild.members.fetch(vencedor.id).catch(() => null);
          if (mem) await addXP(mem, interaction.guild, XP_RECOMPENSAS.evento);
          eventosAtivos.delete(eventoId);
        }, 86400000); // 24h
      }
      return;
    }

    if (sub === "lista") {
      const ativos = [...eventosAtivos.values()];
      if (!ativos.length) return interaction.reply({ content: "📅 Nenhum evento ativo no momento.", ephemeral: true });
      const linhas = ativos.map(e => `• **${e.nome}** — ${e.inscritos.length}/${e.vagas} inscritos | ID: \`${e.id}\``).join("\n");
      const embed  = new EmbedBuilder()
        .setTitle("📅 Eventos Ativos")
        .setDescription(linhas)
        .setColor(BLUE)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "encerrar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEvents) &&
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
      }
      const eventoId = interaction.options.getString("id");
      if (!eventosAtivos.has(eventoId)) return interaction.reply({ content: "❌ Evento não encontrado.", ephemeral: true });
      eventosAtivos.delete(eventoId);
      return interaction.reply({ content: `✅ Evento **${eventoId}** encerrado.` });
    }
  }

  // ── quiz ──
  if (commandName === "quiz") {
    const pergunta = PERGUNTAS_QUIZ[Math.floor(Math.random() * PERGUNTAS_QUIZ.length)];
    const quizId   = `quiz_${Date.now().toString(36)}`;

    eventosAtivos.set(quizId, {
      tipo: "quiz_rodada", channelId: interaction.channelId,
      pergunta, ativo: true, respondido: false,
    });

    const embed = new EmbedBuilder()
      .setTitle("❓ Quiz CS2!")
      .setDescription(`**${pergunta.pergunta}**\n\n> 💡 Dica: ${pergunta.dica}\n\nDigite sua resposta no chat! O primeiro a acertar ganha **150 XP**!`)
      .setColor(BLUE)
      .setFooter({ text: "CS2HUB Quiz • 60 segundos para responder!" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Timeout de 60 segundos
    setTimeout(async () => {
      const quiz = eventosAtivos.get(quizId);
      if (!quiz || quiz.respondido) return;
      quiz.ativo = false;
      eventosAtivos.delete(quizId);
      const embedTimeout = new EmbedBuilder()
        .setTitle("⏰ Tempo esgotado!")
        .setDescription(`Ninguém acertou! A resposta era: **${pergunta.resposta.toUpperCase()}**`)
        .setColor(RED).setTimestamp();
      interaction.channel.send({ embeds: [embedTimeout] }).catch(() => {});
    }, 60000);
    return;
  }

  // ── darxp (admin) ──
  if (commandName === "darxp") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Apenas administradores podem usar este comando.", ephemeral: true });
    }
    const alvo      = interaction.options.getUser("usuario");
    const quantidade = interaction.options.getInteger("quantidade");
    const motivo    = interaction.options.getString("motivo") || "Concedido por admin";
    const member    = await interaction.guild.members.fetch(alvo.id).catch(() => null);
    if (!member)    return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });

    const resultado = await addXP(member, interaction.guild, quantidade, motivo);
    const userData  = getXPUser(alvo.id);
    const nivel     = getNivel(userData.xp);

    const embed = new EmbedBuilder()
      .setTitle("⭐ XP Concedido!")
      .setDescription(`**${quantidade} XP** dados a <@${alvo.id}>${motivo ? `\n> *${motivo}*` : ""}`)
      .setColor(GOLD)
      .addFields(
        { name: "🏅 Nível atual", value: `${nivel.emoji} ${nivel.nome}`, inline: true },
        { name: "⭐ XP total",    value: `${userData.xp.toLocaleString()}`, inline: true },
        resultado.subiu ? { name: "🎉 Level Up!", value: `Subiu para **${resultado.nivel.nome}**!`, inline: false } : { name: "\u200B", value: "\u200B", inline: false },
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
