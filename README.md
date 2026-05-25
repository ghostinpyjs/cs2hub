# COMYCS — CS2 Stats & Inventário

Tracker de CS2 com estatísticas completas e visualização de inventário.

## Stack
- **Next.js 14** (React + API Routes)
- **Steam Web API** (stats, perfil, inventário)
- **Deploy:** Vercel

## Como fazer deploy no Vercel

### Opção 1: Via GitHub (recomendado)
1. Crie um repositório no GitHub e faça push desse projeto
2. Entre em [vercel.com](https://vercel.com) e clique em **Add New Project**
3. Importe o repositório
4. Em **Environment Variables**, adicione:
   - `STEAM_API_KEY` = `A32B786ABA36C2FA09E7F81ECEA06572`
5. Clique em **Deploy** ✅

### Opção 2: Via Vercel CLI
```bash
npm install -g vercel
cd comycs
vercel
# Siga as instruções e adicione a env var STEAM_API_KEY
```

## Rodar localmente
```bash
npm install
npm run dev
# Acesse: http://localhost:3000
```

## Funcionalidades
- 🔍 Busca por nome de usuário Steam ou SteamID64
- 👤 Perfil: avatar, status, horas no CS2
- 📊 Stats: K/D, kills, mortes, win rate, precisão, MVPs, headshots, AWP kills, etc.
- 🎒 Inventário: todos os itens com raridade, exterior, filtros por tipo
- 🏷 Link direto para o Steam Market por item
- 🔒 Trata perfis/inventários privados

## Notas
- Inventário precisa ser **público** no Steam para funcionar
- Stats precisam que o perfil de jogo seja **público**
