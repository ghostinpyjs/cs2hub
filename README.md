# CS2HUB — Deploy no Vercel

Guia completo para hospedar o CS2HUB no Vercel com Vercel KV (Redis).

---

## 🚀 Deploy Passo a Passo

### 1. Criar conta no Vercel

Acesse [vercel.com](https://vercel.com) e crie uma conta gratuita (pode entrar com GitHub).

---

### 2. Obter a Steam API Key

1. Acesse [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
2. Faça login com sua conta Steam
3. Em "Domain Name" coloque o domínio do seu site (ex: `cs2hub.vercel.app`)
4. Copie a **API Key** gerada

---

### 3. Criar repositório no GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SEU_USUARIO/cs2hub.git
git push -u origin main
```

---

### 4. Criar projeto no Vercel

1. No painel Vercel → **Add New → Project**
2. Importe o repositório `cs2hub` do GitHub
3. Configurações de build:
   - **Framework Preset:** Other
   - **Build Command:** (deixe vazio)
   - **Output Directory:** `.` (ponto — raiz do projeto)
4. **Não clique em Deploy ainda** — configure o KV primeiro

---

### 5. Criar o Vercel KV (banco de dados)

1. No painel Vercel → **Storage** → **Create Database**
2. Escolha **KV (Redis)**
3. Nome: `players-db`
4. Região: escolha a mais próxima (ex: São Paulo — `gru1`)
5. Clique em **Create**
6. Na página do KV criado → **Connect to Project** → selecione seu projeto `cs2hub`
7. Isso adicionará automaticamente as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` ao projeto

---

### 6. Configurar variáveis de ambiente

No projeto Vercel → **Settings** → **Environment Variables**, adicione:

| Variable | Value | Environments |
|----------|-------|-------------|
| `STEAM_API_KEY` | Sua chave da Steam API | Production, Preview, Development |
| `SITE_URL` | `https://seusite.vercel.app` | Production, Preview, Development |

> As variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` já foram adicionadas automaticamente no passo 5.

---

### 7. Deploy

Agora faça o deploy:

```bash
git add .
git commit -m "Deploy inicial"
git push
```

O Vercel fará o deploy automaticamente. A partir daqui, qualquer `git push` para `main` atualiza o site.

---

### 8. Atualizar o SITE_URL

Após o primeiro deploy, copie a URL gerada (ex: `https://cs2hub.vercel.app`) e atualize a variável `SITE_URL` nas configurações.

Também atualize o campo "Domain Name" na sua Steam API Key com essa URL.

---

## 🔧 Desenvolvimento Local

```bash
npm install
npm install -g vercel
vercel login
vercel dev
```

Crie o arquivo `.env.local` na raiz:

```env
STEAM_API_KEY=sua_chave_aqui
SITE_URL=http://localhost:3000
KV_REST_API_URL=URL_do_seu_KV_no_painel_Vercel
KV_REST_API_TOKEN=TOKEN_do_seu_KV_no_painel_Vercel
```

> Para pegar `KV_REST_API_URL` e `KV_REST_API_TOKEN` localmente: no painel Vercel → Storage → seu KV → **`.env.local` Snippet** → copie e cole no seu arquivo.

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
├── api/                          ← antes era /functions (Cloudflare)
│   ├── steam-callback.js         # Valida retorno OpenID Steam
│   ├── steam-profile.js          # Busca perfil + stats CS2
│   ├── steam-inventory.js        # Inventário + preços Steam Market
│   ├── ranking.js                # Lista ordenada de jogadores
│   └── search.js                 # Pesquisa por nick no KV
├── vercel.json         # Rotas e configurações
├── package.json        # Dependência: @vercel/kv
└── README.md
```

---

## 🔄 Diferenças: Cloudflare Pages → Vercel

| Cloudflare Pages | Vercel |
|-----------------|--------|
| `/functions/*.js` | `/api/*.js` |
| `Request` / `Response` Web API | `req` / `res` Node.js |
| `env.PLAYERS_DB.get()` (KV Cloudflare) | `kv.get()` via `@vercel/kv` |
| `env.PLAYERS_DB.set()` | `kv.set()` |
| `_redirects` | `vercel.json` |
| `PLAYERS_DB` binding manual | `KV_REST_API_URL` + `KV_REST_API_TOKEN` automáticos |

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
- Todas as chamadas à Steam API passam pelas **Vercel Serverless Functions**
- Validação OpenID feita server-side
- XSS prevenido com escape de HTML em todo conteúdo dinâmico

---

## 📄 Licença

MIT — Livre para uso pessoal e comercial.
