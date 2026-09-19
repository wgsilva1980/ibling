# ibling - Integração Bling + Donatelle Concept

**Sistema privado de sincronização entre o CRM Bling e painel administrativo de produtos/estoque.**

Um painel web moderno para gerenciar produtos e estoque do Bling com sincronização em tempo real, webhooks e reconciliação automática diária.

---

## 🎯 Funcionalidades Principais

- **🔐 Autenticação** - Login seguro com Supabase Auth
- **📦 Sincronização** - Importação inicial e sincronização diária de produtos
- **🔄 Webhooks** - Atualizações em tempo real quando algo muda no Bling
- **⏰ Cron Jobs** - Renovação automática de tokens e reconciliação
- **📊 Dashboard** - Interface web limpa para visualizar produtos e estoque
- **🔍 Busca & Filtros** - Busque por nome/código e filtre por situação
- **💾 Banco de Dados** - Supabase Postgres com RLS

---

## 🏗️ Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 15 + TypeScript + React |
| **Backend** | Next.js API Routes |
| **Database** | Supabase (Postgres) |
| **Auth** | Supabase Auth (OAuth + JWT) |
| **Integração** | Bling API v3 |
| **Deploy** | Vercel (com Crons) |

---

## 📁 Estrutura do Projeto

```
ibling/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── bling/
│   │   │   ├── callback/         # OAuth callback do Bling
│   │   │   ├── webhook/          # Webhooks do Bling
│   │   │   └── sync-inicial/     # Sincronização manual
│   │   └── cron/
│   │       ├── refresh-token/    # Renovar token (3h)
│   │       └── reconciliar/      # Sync diária (3h)
│   ├── auth/
│   │   ├── login/                # Página de login
│   │   └── authorized/           # Sucesso da autorização
│   └── (dashboard)/
│       └── produtos/
│           ├── page.tsx          # Listagem
│           └── [id]/
│               └── page.tsx      # Detalhe + Estoque
│
├── lib/
│   ├── bling/
│   │   ├── auth.ts               # OAuth + Token Refresh
│   │   ├── client.ts             # HTTP Client (Rate Limit)
│   │   └── sync.ts               # Sincronização
│   └── supabase/
│       ├── server.ts             # Client Backend
│       └── client.ts             # Client Frontend
│
├── supabase/
│   ├── schema.sql                # Schema do BD
│   └── README.md                 # Setup Supabase
│
├── .env.local                    # Variáveis de ambiente
├── .env.example                  # Template de variáveis
├── vercel.json                   # Config de Crons
├── SETUP.md                      # Guia de configuração
├── TESTING.md                    # Roteiro de testes
├── DEPLOYMENT.md                 # Guia de deploy
└── README.md                     # Este arquivo
```

---

## 🚀 Quick Start

### 1. Clonar Repositório

```bash
git clone <seu-repo> ibling
cd ibling
npm install
```

### 2. Configurar Variáveis

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha com suas credenciais (veja [SETUP.md](./SETUP.md)).

### 3. Setup Supabase

1. Execute o SQL em `supabase/schema.sql`
2. Veja [SETUP.md - Passo 2](./SETUP.md#-passo-2-configurar-banco-de-dados-supabase)

### 4. Registrar App Bling

Veja [SETUP.md - Passo 1](./SETUP.md#-passo-1-registrar-app-no-bling)

### 5. Rodar Localmente (Opcional)

```bash
npm run dev
# Acesse http://localhost:3000
```

### 6. Fazer Deploy

```bash
npm install -g vercel
vercel --prod
```

Veja [DEPLOYMENT.md](./DEPLOYMENT.md) para instruções completas.

---

## 📚 Documentação Completa

- **[SETUP.md](./SETUP.md)** - Guia passo-a-passo de configuração inicial
- **[TESTING.md](./TESTING.md)** - Roteiro com 10 testes para validar o sistema
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Instruções de deployment na Vercel
- **[supabase/README.md](./supabase/README.md)** - Setup do banco de dados

---

## 🔄 Fluxo de Dados

```
┌──────────────────┐
│  Bling API v3    │ ← Você autoriza uma vez
│  (OAuth 2.0)     │
└────────┬─────────┘
         │
         ├─ [Sync Inicial]   → Importa todos os produtos
         │
         ├─ [Webhooks]       → Atualização em tempo real
         │   (quando muda no Bling)
         │
         ├─ [Cron 3h]        → Renova token automaticamente
         │
         └─ [Cron Daily]     → Reconcilia mudanças
                              (captura o que webhooks perderam)
             │
             ▼
         ┌───────────────┐
         │   Supabase    │
         │  (4 Tabelas)  │
         └───────────────┘
             │
             ▼
         ┌───────────────┐
         │   Dashboard   │
         │   Next.js     │
         └───────────────┘
```

---

## 🔐 Segurança

- **Autenticação**: Supabase Auth com email/senha
- **Autorização**: OAuth 2.0 com Bling (feito uma vez)
- **Banco**: RLS (Row Level Security) em todas as tabelas
- **Variáveis**: Sensíveis protegidas apenas no backend
- **Rate Limit**: Respeita limite do Bling (3 req/s)

---

## 📊 Endpoints Principais

| Método | URL | Descrição |
|--------|-----|-----------|
| GET | `/auth/login` | Página de login |
| POST | `/auth/login` | Submeter login |
| GET | `/produtos` | Listar produtos (dashboard) |
| GET | `/produtos/[id]` | Detalhe do produto |
| GET | `/api/bling/callback` | Callback OAuth |
| POST | `/api/bling/webhook` | Webhooks do Bling |
| GET | `/api/bling/sync-inicial` | Sincronizar manualmente |
| GET | `/api/cron/refresh-token` | Renovar token (Cron 3h) |
| GET | `/api/cron/reconciliar` | Reconciliação (Cron Daily) |

---

## 🐛 Troubleshooting

**Erro: "No token found"**
→ Faça a autorização OAuth acessando a URL do Bling

**Erro: "Missing environment variables"**
→ Verifique `.env.local` e variáveis no painel da Vercel

**Produtos não aparecem**
→ Clique em "Sincronizar" na página de produtos

**Webhooks não funcionam**
→ Registre a URL no painel do Bling: `https://seu-dominio.com/api/bling/webhook`

Veja [TESTING.md](./TESTING.md) para roteiro completo de testes.

---

## 📈 Próximas Iterações (Roadmap)

- [ ] Edição de produtos pelo painel
- [ ] Ajustes manuais de estoque
- [ ] Relatórios e análises
- [ ] Múltiplos usuários com permissões
- [ ] Export de dados
- [ ] Dark mode

---

## 📞 Suporte

1. Verifique `bling_sync_log` no Supabase para erros
2. Veja logs no painel da Vercel (Deployments → Logs)
3. Confirme que webhooks estão registrados no Bling

---

## 📄 Licença

Privado - Para uso exclusivo da Donatelle Concept

---

## 🙏 Créditos

Construído com ❤️ usando Claude Code e assistência de IA.

**Começar agora**: Leia [SETUP.md](./SETUP.md) para instruções passo-a-passo.
