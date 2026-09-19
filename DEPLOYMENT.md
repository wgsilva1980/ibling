# Guia de Deployment - ibling

Instruções para fazer deploy na Vercel em produção.

---

## 🚀 Pré-Deploy Checklist

Antes de fazer deploy, verifique:

- [ ] Arquivo `.env.local` está preenchido com todas as chaves
- [ ] Banco de dados Supabase está configurado (todas as tabelas criadas)
- [ ] App Bling está registrado e tem Client ID/Secret
- [ ] Você tem conta Vercel e está logado
- [ ] Repositório Git tem todos os commits

---

## 📦 Deploy Opção 1: Via CLI (Recomendado)

### Passo 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Passo 2: Fazer Login

```bash
vercel login
```

### Passo 3: Deploy

```bash
# Fazer deploy automático
vercel --prod
```

Selecione:
- **Project name**: ibling
- **Framework**: Next.js
- **Root directory**: ./

### Passo 4: Configurar Variáveis

O Vercel vai perguntar se quer importar variáveis de `.env.local`.
Clique em **Import** ou configure manualmente:

1. Vá para painel Vercel → seu projeto
2. Settings → Environment Variables
3. Adicione cada variável:

```
BLING_CLIENT_ID=xxxxx
BLING_CLIENT_SECRET=xxxxx
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 🔗 Deploy Opção 2: Via GitHub (Com CI/CD)

### Passo 1: Fazer Push para GitHub

```bash
git remote add origin https://github.com/seu-usuario/ibling.git
git branch -M main
git push -u origin main
```

### Passo 2: Conectar Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **New Project**
3. Selecione **Import Git Repository**
4. Procure por seu repositório `ibling`
5. Clique em **Import**

### Passo 3: Configurar Variáveis

1. Na página de configuração do projeto:
2. Vá para **Environment Variables**
3. Adicione todas as 7 variáveis (ver acima)
4. Clique em **Deploy**

### Passo 4: Deploy Automático

Agora, sempre que você fazer `git push main`, o Vercel vai fazer deploy automaticamente.

---

## 🎯 Configurações Importantes na Vercel

### Environment Variables (Produção)

Certifique-se de adicionar as variáveis **apenas para Produção**:

1. Settings → Environment Variables
2. Clique em cada variável
3. Selecione apenas **Production**

Isso garante que variáveis sensíveis não apareçam em previews.

### Domínio Personalizado

Se quer um domínio personalizado:

1. Settings → Domains
2. Adicione seu domínio (ex: `ibling.donatelleconcept.com`)
3. Siga as instruções para apontar os registros DNS

Depois, atualize no app Bling:
- Link de Redirecionamento: `https://seu-dominio.com/api/bling/callback`
- Link da Homepage: `https://seu-dominio.com`

---

## ✅ Após o Deploy

### 1. Verificar Saúde da Aplicação

```bash
# Testar homepage
curl https://ibling.vercel.app

# Testar login
https://ibling.vercel.app/auth/login

# Testar API
curl https://ibling.vercel.app/api/bling/sync-inicial
# (deve retornar 500 se não autorizado, o que é esperado)
```

### 2. Registrar Webhook no Bling

1. Acesse [bling.com.br](https://www.bling.com.br)
2. Vá para **Central de Extensões** → **Webhooks** (ou Meus Apps)
3. Procure seu app "ibling"
4. Registre a URL do webhook:
   ```
   https://ibling.vercel.app/api/bling/webhook
   ```
5. Assine os eventos:
   - ✅ Produto criado
   - ✅ Produto atualizado
   - ✅ Produto excluído
   - ✅ Alteração de estoque

### 3. Fazer Autorização OAuth

1. Acesse a URL de autorização:
   ```
   https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=SEU_CLIENT_ID&state=prod
   ```

2. Autorize a aplicação

3. Será redirecionado para:
   ```
   https://ibling.vercel.app/api/bling/callback?code=...
   ```

4. Você verá "Autorização Sucesso!"

### 4. Sincronizar Produtos

1. Acesse https://ibling.vercel.app
2. Faça login
3. Clique em "Sincronizar"
4. Aguarde a sincronização

---

## 🔍 Monitorar Deployment

### Logs da Vercel

```bash
vercel logs
```

Ou no painel:
1. Vá para seu projeto
2. Clique em **Deployments**
3. Clique no deployment mais recente
4. Abra aba **Logs** (Runtime Logs ou Build Logs)

### Erros Comuns

| Erro | Solução |
|------|---------|
| `Error: SUPABASE_URL is not defined` | Adicione variáveis de ambiente no painel Vercel |
| `OAuth token expired` | Faça login novamente no Bling |
| `404 Not Found` | Verifique se o deployment foi bem-sucedido |

---

## 📊 Crons Automáticos

Após o deployment, os crons executam automaticamente:

- **Refresh Token**: a cada 3 horas (0 */3 * * *)
- **Reconciliação**: diariamente às 3h (0 3 * * *)

Você pode ver a execução em:
1. Painel Vercel → seu projeto
2. Cron Jobs (aba lateral)
3. Clique para ver logs

---

## 🔐 Segurança em Produção

### Checklist de Segurança

- [ ] `SUPABASE_SERVICE_ROLE_KEY` está em variáveis de produção
- [ ] `BLING_CLIENT_SECRET` está em variáveis de produção
- [ ] Não há variáveis sensíveis em `.env.example`
- [ ] Git ignore `.env.local`
- [ ] RLS está ativo em todas as tabelas Supabase
- [ ] Autenticação Supabase é obrigatória para acessar dashboard

### Rate Limiting

A aplicação respeita:
- 3 requisições/segundo do Bling
- Retry automático com backoff de 1200ms

---

## 🚨 Rollback (Se Necessário)

Se algo der errado após o deployment:

### Via CLI

```bash
vercel rollback
```

Selecione a versão anterior.

### Via Painel

1. Vercel → seu projeto → Deployments
2. Clique no deployment anterior (que funcionava)
3. Clique em **Redeploy**

---

## 📈 Próximas Melhorias

Após confirmar que tudo está funcionando:

- [ ] Configurar domínio personalizado
- [ ] Ativar auto-deploy via GitHub
- [ ] Adicionar monitoramento (Sentry, LogRocket)
- [ ] Configurar alertas de erro
- [ ] Fazer backup periódico do Supabase

---

**Deploy concluído com sucesso! 🎉**
