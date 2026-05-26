# CS2HUB — Plataforma de Rankings e Perfis para Counter-Strike 2

Site completo de CS2 com login Steam, ranking global, perfis detalhados e inventário valorizado. Hospedado 100% no **Cloudflare Pages** — grátis, sem servidor próprio.

---

## ✨ Funcionalidades

- 🔐 **Login via Steam (OpenID 2.0)** — Autenticação oficial, sem senhas
- 🏆 **Ranking Global** — Todos os jogadores que logaram, ordenável por ELO, horas, K/D, nível Steam e valor de inventário
- 📊 **Perfil Completo** — Kills, mortes, K/D, headshot %, arma favorita, MVPs, bombas plantadas
- 💰 **Inventário Valorizado** — Todos os itens CS2 com preços do Steam Market em USD e R$
- 🔍 **Pesquisa de Jogadores** — Busque qualquer jogador pelo nick
- 💾 **Banco de dados Cloudflare KV** — Armazena todos os jogadores automaticamente
- 📱 **Responsivo** — Funciona em mobile e desktop

---

## 🚀 Deploy Passo a Passo

### 1. Criar conta no Cloudflare Pages

1. Acesse [cloudflare.com](https://cloudflare.com) e crie uma conta gratuita
2. No painel, clique em **Workers & Pages** → **Pages**

### 2. Obter a Steam API Key

1. Acesse [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
2. Faça login com sua conta Steam
3. Em "Domain Name" coloque o domínio do seu site (ex: `cs2hub.pages.dev`)
4. Copie a **API Key** gerada

### 3. Criar repositório no GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SEU_USUARIO/cs2hub.git
git push -u origin main
```

### 4. Conectar ao Cloudflare Pages

1. No painel Cloudflare → **Pages** → **Create a project**
2. Selecione **Connect to Git** → autorize o GitHub
3. Escolha o repositório `cs2hub`
4. Configurações de build:
   - **Framework preset:** None
   - **Build command:** (deixe vazio)
   - **Build output directory:** `/` (raiz)
5. Clique em **Save and Deploy**

### 5. Criar o KV Namespace

1. No painel Cloudflare → **Workers & Pages** → **KV**
2. Clique em **Create a namespace**
3. Nome: `PLAYERS_DB`
4. Clique em **Add**

### 6. Vincular KV ao projeto Pages

1. Vá em **Pages** → selecione seu projeto → **Settings** → **Functions**
2. Em **KV namespace bindings**, clique em **Add binding**
3. Variable name: `PLAYERS_DB`
4. KV namespace: selecione `PLAYERS_DB`
5. Salve

### 7. Configurar variáveis de ambiente

1. No projeto Pages → **Settings** → **Environment variables**
2. Adicione as seguintes variáveis em **Production** e **Preview**:

| Variable | Value |
|----------|-------|
| `STEAM_API_KEY` | Sua chave da Steam API |
| `SITE_URL` | `https://seusite.pages.dev` (URL do seu site) |

### 8. Deploy automático

A partir daqui, qualquer `git push` para a branch `main` fará deploy automático:

```bash
git add .
git commit -m "Update"
git push
```

---

## 🔧 Desenvolvimento Local

Para testar localmente, instale o Wrangler:

```bash
npm install -g wrangler
wrangler login
wrangler pages dev . --kv PLAYERS_DB
```

Configure as variáveis locais no arquivo `.dev.vars`:

```env
STEAM_API_KEY=sua_chave_aqui
SITE_URL=http://localhost:8788
```

---

## 📁 Estrutura de Arquivos

```
/
├── index.html          # Home page
├── ranking.html        # Ranking global
├── jogador.html        # Perfil de jogador + pesquisa
├── perfil.html         # Meu perfil (requer login)
├── 404.html            # Página 404 customizada
├── css/
│   └── style.css       # Estilos (tema CS2 dark)
├── js/
│   ├── auth.js         # Login/logout Steam
│   ├── main.js         # Utilitários + home
│   ├── ranking.js      # Lógica do ranking
│   ├── inventory.js    # Exibição do inventário
│   └── search.js       # Pesquisa + perfil de jogador
├── functions/
│   ├── steam-callback.js   # Valida retorno do OpenID Steam
│   ├── steam-profile.js    # Busca perfil + stats CS2
│   ├── steam-inventory.js  # Inventário + preços Steam Market
│   ├── ranking.js          # Lista ordenada de jogadores
│   └── search.js           # Pesquisa por nick no KV
├── _redirects          # Regras de roteamento
└── README.md
```

---

## ⚠️ Limitações da API Steam

| Dado | Disponibilidade |
|------|----------------|
| Perfil básico (avatar, nick) | Sempre disponível se perfil público |
| Stats de CS2 (kills, mortes, etc.) | Requer **perfil de jogo público** |
| Inventário | Requer **inventário público** |
| ELO Premier | **Não disponível** via API pública — será N/D |
| Preços Steam Market | Cache de 1h para evitar rate limit |

---

## 🔑 Segurança

- A `STEAM_API_KEY` **nunca** é exposta ao frontend
- Todas as chamadas à Steam API passam pelas **Cloudflare Functions** (serverless)
- Validação OpenID feita server-side
- XSS prevenido com escape de HTML em todo conteúdo dinâmico

---

## 🎨 Customização

Para alterar o nome do site, edite o `<title>` nos HTMLs e o logo na navbar (busque por `CS2HUB`).

Para alterar cores, edite as variáveis CSS no início de `css/style.css`:

```css
:root {
  --orange: #f0820f;   /* cor principal */
  --bg-primary: #0a0b0d; /* fundo */
}
```

---

## 📄 Licença

MIT — Livre para uso pessoal e comercial.
