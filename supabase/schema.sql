-- Tabela de tokens Bling (app privado = uma única linha)
create table if not exists bling_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz default now()
);

-- Habilitar RLS
alter table bling_tokens enable row level security;

-- Policy para service role (backend)
create policy "Service role can manage tokens" on bling_tokens
  for all using (true) with check (true);

---

-- Tabela de produtos
create table if not exists bling_produtos (
  id bigint primary key,
  codigo text,
  nome text,
  preco numeric,
  situacao text,
  saldo_fisico_total numeric default 0,
  atualizado_em timestamptz default now(),
  raw jsonb
);

-- Habilitar RLS
alter table bling_produtos enable row level security;

-- Policy para service role
create policy "Service role can manage products" on bling_produtos
  for all using (true) with check (true);

-- Policy para usuários autenticados (leitura apenas)
create policy "Authenticated users can view products" on bling_produtos
  for select using (auth.role() = 'authenticated');

---

-- Tabela de estoque por depósito
create table if not exists bling_estoque_depositos (
  produto_id bigint references bling_produtos(id) on delete cascade,
  deposito_id bigint,
  deposito_nome text,
  saldo_fisico numeric,
  saldo_virtual numeric,
  atualizado_em timestamptz default now(),
  primary key (produto_id, deposito_id)
);

-- Habilitar RLS
alter table bling_estoque_depositos enable row level security;

-- Policy para service role
create policy "Service role can manage stock" on bling_estoque_depositos
  for all using (true) with check (true);

-- Policy para usuários autenticados (leitura apenas)
create policy "Authenticated users can view stock" on bling_estoque_depositos
  for select using (auth.role() = 'authenticated');

---

-- Tabela de log de sincronização
create table if not exists bling_sync_log (
  id bigserial primary key,
  tipo text,
  status text,
  detalhes jsonb,
  created_at timestamptz default now()
);

-- Habilitar RLS
alter table bling_sync_log enable row level security;

-- Policy para service role
create policy "Service role can manage sync logs" on bling_sync_log
  for all using (true) with check (true);

-- Policy para usuários autenticados (leitura apenas)
create policy "Authenticated users can view sync logs" on bling_sync_log
  for select using (auth.role() = 'authenticated');

---

-- Criar índices para melhor performance
create index if not exists idx_bling_produtos_codigo on bling_produtos(codigo);
create index if not exists idx_bling_produtos_nome on bling_produtos(nome);
create index if not exists idx_bling_estoque_depositos_deposito on bling_estoque_depositos(deposito_id);
create index if not exists idx_bling_sync_log_tipo on bling_sync_log(tipo);
create index if not exists idx_bling_sync_log_created on bling_sync_log(created_at);
