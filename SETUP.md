# ibling - Guia de Configuração Completo

Integração entre a Loja Donatelle Concept e o CRM Bling com painel administrativo.

## 📋 Pré-requisitos

Antes de começar, tenha preparado:

1. **Conta Bling** com acesso de administrador
2. **Projeto Supabase** já criado
3. **Conta Vercel** para deploy
4. **Node.js 18+** (para desenvolvimento local)

---

## 🔧 Passo 1: Registrar App no Bling

> **Nota**: Esta é uma ação manual que você precisa fazer no painel do Bling

1. Acesse [Bling.com.br](https://www.bling.com.br)
2. Vá para **Central de Extensões** → **Área do Integrador**
3. Clique em **Criar Aplicativo**
4. Preencha os dados:
   - **Visibilidade**: Privado
   - **Nome**: `ibling` (ou outro nome)
   - **Descrição**: "Integração de produtos e estoque"
   - **Link de Redirecionamento**: `https://ibling.vercel.app/api/bling/callback` (ou seu domínio)
   - **Link da Homepage**: `https://ibling.vercel.app`

5. Em **Escopos**, marque:
   - ✅ Produtos (leitura + escrita)
   - ✅ Estoques (leitura + escrita)

6. Clique em **Salvar**
7. Copie o **Client ID** e **Client Secret**

---

## 🗄️ Passo 2: Configurar Banco de Dados (Supabase)

1. Acesse seu projeto em [app.supabase.com](https://app.supabase.com)

2. Vá para **SQL Editor** e crie uma nova query

3. Cole o conteúdo do arquivo `supabase/schema.sql`

4. Execute (Ctrl+Enter ou clique em Run)

5. Verifique se as 4 tabelas foram criadas:
   - `bling_tokens`
   - `bling_produtos`
   - `bling_estoque_depositos`
   - `bling_sync_log`

6. Vá para **Authentication** → **Providers**
   - Verifique se "Email" está habilitado
   - Opcionalmente, ative "Autoconfirm" para testes

7. Crie um usuário administrativo:
   - Vá para **Authentication** → **Users**
   - Clique em **Add user**
   - Defina email e senha

---

## 🔑 Passo 3: Configurar Variáveis de Ambiente

1. Abra o arquivo `.env.local` (criado automaticamente)

2. Preencha com as seguintes informações:

```bash
# Bling
BLING_CLIENT_ID=seu_client_id
BLING_CLIENT_SECRET=seu_client_secret

# Supabase (obtém em Settings → API)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Onde encontrar essas chaves**:
- Vá para seu projeto no Supabase
- Clique em **Settings** → **API** (canto esquerdo)
- Copie **Project URL** e as chaves

---

## 🚀 Passo 4: Deploy na Vercel

### Opção A: Via CLI (Recomendado)

```bash
npm install -g vercel
vercel --prod
```

### Opção B: Via GitHub

1. Faça push do código para GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em **New Project**
4. Selecione seu repositório
5. Configure variáveis de ambiente
6. Deploy automático

### Configurar Variáveis na Vercel

1. Vá para seu projeto no painel da Vercel
2. Clique em **Settings** → **Environment Variables**
3. Adicione todas as variáveis de `.env.local`:
   - `BLING_CLIENT_ID`
   - `BLING_CLIENT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Clique em **Save**

---

## ✅ Passo 5: Autorizar Bling

Após o deploy na Vercel:

1. Acesse a URL de autorização do Bling:
   ```
   https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=SEU_CLIENT_ID&state=algumvalor
   ```

2. Clique em "Autorizar"

3. Será redirecionado para `/auth/authorized` com mensagem de sucesso

4. Os tokens foram armazenados automaticamente no Supabase

---

## 🔄 Passo 6: Sincronização Inicial

Após a autorização, sincronize os produtos:

1. Acesse seu dashboard: `https://ibling.vercel.app`

2. Faça login com as credenciais do Supabase Auth

3. Clique no botão **Sincronizar**

4. Aguarde a conclusão (pode levar alguns minutos)

5. Os produtos serão listados automaticamente

---

## 📝 Fluxo de Dados

```
┌─────────────────┐
│  Bling API v3   │
│  (OAuth 2.0)    │
└────────┬────────┘
         │
         ├─→ [Initial Sync] Busca todos os produtos
         │
         ├─→ [Webhooks] Atualiza em tempo real
         │   (quando produto muda no Bling)
         │
         ├─→ [Cron Daily] Reconcilia mudanças
         │   (diariamente às 3h)
         │
         └─→ [Cron 3h] Renova tokens
             (a cada 3 horas)
             │
             ▼
         ┌──────────────┐
         │   Supabase   │
         │  (Postgres)  │
         └──────────────┘
             │
             ▼
        ┌────────────┐
        │ Dashboard  │
        │  Next.js   │
        └────────────┘
```

---

## 🎯 Endpoints Principais

| URL | Descrição |
|-----|-----------|
| `/auth/login` | Página de login |
| `/produtos` | Listagem de produtos |
| `/produtos/[id]` | Detalhe do produto |
| `/api/bling/callback` | Callback OAuth do Bling |
| `/api/bling/webhook` | Webhooks do Bling |
| `/api/bling/sync-inicial` | Sincronização manual |
| `/api/cron/refresh-token` | Renovação de token (3h) |
| `/api/cron/reconciliar` | Reconciliação diária (3h) |

---

## 🐛 Troubleshooting

### Erro: "Missing Supabase environment variables"

- Verifique se `.env.local` tem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- Verifique se as chaves estão corretas (copie novamente de Settings → API)

### Erro: "No token found"

- A autorização ainda não foi feita
- Acesse a URL de autorização do Bling e autorize
- Aguarde redirecionamento para `/auth/authorized`

### Erro: "Failed to refresh token"

- Verifique se `BLING_CLIENT_ID` e `BLING_CLIENT_SECRET` estão corretos
- Verifique se o app ainda existe no painel do Bling

### Produtos não aparecem

- Clique em "Sincronizar" na página de produtos
- Aguarde a sincronização completar
- Verifique em Supabase se `bling_produtos` tem dados

### Cron jobs não executam

- Verifique se `vercel.json` existe e tem configuração correta
- Deploy novamente para a Vercel
- Crons rodam apenas em ambiente de produção (não local)

---

## 📊 Monitorar Sincronizações

Verifique o log de sincronizações em Supabase:

1. Vá para seu projeto Supabase
2. **SQL Editor** → Nova query
3. Execute:
   ```sql
   SELECT * FROM bling_sync_log ORDER BY created_at DESC LIMIT 20;
   ```

Colunas:
- `tipo`: 'inicial' | 'incremental' | 'webhook'
- `status`: 'sucesso' | 'erro'
- `detalhes`: JSON com informações adicionais

---

## 🔐 Segurança

**Variáveis Sensíveis**:
- ✅ `SUPABASE_SERVICE_ROLE_KEY` — Use apenas no backend, nunca exponha
- ✅ `BLING_CLIENT_SECRET` — Protegido, use apenas no servidor
- ❌ `BLING_CLIENT_ID` — Pode ser público (usa OAuth)

**RLS (Row Level Security)**:
- Tabelas de Bling são protegidas por RLS
- Usuários autenticados podem ler dados
- Apenas service role pode escrever

---

## 📚 Próximas Iterações (Futuro)

- [ ] Edição de estoque pelo painel
- [ ] Edição de produtos
- [ ] Análise de vendas
- [ ] Múltiplos usuários com permissões
- [ ] Export de relatórios
- [ ] Dark mode

---

## 📞 Suporte

Para problemas:

1. Verifique o **Supabase SQL Editor** → `bling_sync_log` para erros
2. Verifique logs na **Vercel** (Deployments → Logs)
3. Confirme que **webhooks do Bling** estão registrados e ativos

---

**Criado com ❤️ por Claude Code**
