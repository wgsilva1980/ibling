# Configuração do Supabase

## Pré-requisitos

- Projeto Supabase já criado
- Acesso ao painel do Supabase

## Passos para Configurar

### 1. Executar Script SQL

1. Acesse seu projeto no [painel do Supabase](https://app.supabase.com)
2. Vá para **SQL Editor** → **New Query**
3. Cole o conteúdo de `schema.sql`
4. Execute a query (clique em **Run** ou Ctrl+Enter)

Isso vai criar:
- Tabela `bling_tokens` (armazenar tokens da API Bling)
- Tabela `bling_produtos` (catálogo de produtos)
- Tabela `bling_estoque_depositos` (estoque por depósito)
- Tabela `bling_sync_log` (log de sincronizações)

### 2. Habilitar Autenticação por Email/Senha

1. Vá para **Authentication** → **Providers**
2. Procure por "Email" e verifique se está **habilitado**
3. Configure as opções conforme necessário:
   - Email confirmação (opcional)
   - Autoconfirm (recomendado para desenvolvimento)

### 3. Criar Usuário Administrativo

1. Vá para **Authentication** → **Users**
2. Clique em **Add user** (ou convide por email)
3. Defina email e senha
4. Este usuário terá acesso ao painel administrativo

### 4. Copiar Chaves de Acesso

1. Vá para **Settings** → **API**
2. Copie:
   - **Project URL** → `SUPABASE_URL`
   - **Service Role Secret** → `SUPABASE_SERVICE_ROLE_KEY` (backend)
   - **Anon Public** → `SUPABASE_ANON_KEY` (frontend)

3. Cole essas chaves no `.env.local`:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   SUPABASE_ANON_KEY=eyJ...
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

### 5. Verificar Tabelas

1. Vá para **SQL Editor** e execute:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

Você deve ver as 4 tabelas criadas acima.

## Próximas Etapas

- Depois de configurar o banco, execute a Fase 3 (autenticação do dashboard)
- O script de sync inicial preencherá `bling_produtos` e `bling_estoque_depositos`
