# Roteiro de Testes - ibling

Antes de considerar o sistema pronto para produção, execute todos os testes abaixo.

---

## ✅ Teste 1: Autenticação Supabase Auth

**Objetivo**: Verificar se o login funciona corretamente

**Passos**:
1. Acesse `https://ibling.vercel.app/auth/login`
2. Tente com credenciais inválidas → deve mostrar erro
3. Faça login com o usuário criado no Supabase
4. Deve redirecionar para `/produtos`
5. Clique em "Logout" no header
6. Deve redirecionar para `/auth/login`

**Resultado esperado**: ✅ Login/logout funcionando

---

## ✅ Teste 2: Autorização OAuth Bling

**Objetivo**: Verificar se o fluxo OAuth com Bling funciona

**Passos**:
1. Acesse a URL de autorização:
   ```
   https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=SEU_CLIENT_ID&state=test
   ```
2. Faça login no Bling (se necessário)
3. Clique em "Autorizar"
4. Deve redirecionar para `https://ibling.vercel.app/api/bling/callback?code=...`
5. Deve exibir página de sucesso
6. Verificar no Supabase:
   ```sql
   SELECT * FROM bling_tokens LIMIT 1;
   ```
   Deve ter uma linha com tokens válidos

**Resultado esperado**: ✅ Tokens armazenados no Supabase

---

## ✅ Teste 3: Sincronização Inicial

**Objetivo**: Verificar se a sincronização de produtos funciona

**Passos**:
1. Acesse `/produtos` no dashboard
2. Clique em botão "Sincronizar"
3. Aguarde a sincronização completar (1-5 minutos dependendo do catálogo)
4. Deve exibir mensagem de sucesso
5. Produtos devem aparecer na tabela
6. Verificar no Supabase:
   ```sql
   SELECT COUNT(*) as total FROM bling_produtos;
   SELECT COUNT(*) as total FROM bling_estoque_depositos;
   ```

**Resultado esperado**: 
- ✅ Produtos listados no dashboard
- ✅ Dados sincronizados no Supabase
- ✅ Log registrado em `bling_sync_log`

---

## ✅ Teste 4: Busca e Filtros

**Objetivo**: Verificar se search e filtros funcionam

**Passos**:
1. Na página `/produtos`, use o campo de busca
2. Digite o nome ou código de um produto
3. Deve filtrar resultados em tempo real
4. Selecione um filtro de situação (Ativo/Inativo)
5. Deve mostrar apenas produtos daquela situação

**Resultado esperado**: ✅ Busca e filtros funcionando

---

## ✅ Teste 5: Detalhes do Produto

**Objetivo**: Verificar página de detalhe e estoque por depósito

**Passos**:
1. Na listagem de produtos, clique em "Ver"
2. Deve abrir a página de detalhe do produto
3. Verificar informações: código, nome, preço, situação, saldo
4. Verificar tabela de estoque por depósito
5. Saldo total deve ser a soma dos depósitos

**Resultado esperado**: ✅ Dados exibidos corretamente

---

## ✅ Teste 6: Webhook do Bling

**Objetivo**: Verificar se atualizações em tempo real funcionam

**Passos**:
1. Altere um produto direto no painel do Bling
   - Mude o nome ou preço
2. Aguarde poucos segundos
3. Volte ao dashboard e recarregue a página
4. O produto deve mostrar os dados atualizados
5. Verificar em Supabase:
   ```sql
   SELECT * FROM bling_sync_log WHERE tipo = 'webhook' 
   ORDER BY created_at DESC LIMIT 5;
   ```

**Resultado esperado**: 
- ✅ Mudança sincronizada rapidamente
- ✅ Webhook registrado em logs

---

## ✅ Teste 7: Cron Job de Renovação de Token

**Objetivo**: Verificar se token é renovado automaticamente

**Passos**:
1. No Supabase, note o valor de `expires_at` atual:
   ```sql
   SELECT expires_at FROM bling_tokens ORDER BY updated_at DESC LIMIT 1;
   ```
2. Aguarde 3 horas (ou simule acessando `/api/cron/refresh-token`)
3. Verifique se `expires_at` foi atualizado:
   ```sql
   SELECT expires_at, updated_at FROM bling_tokens 
   ORDER BY updated_at DESC LIMIT 1;
   ```

**Resultado esperado**: ✅ Token renovado, `updated_at` atualizado

---

## ✅ Teste 8: Cron Job de Reconciliação

**Objetivo**: Verificar sincronização diária incremental

**Passos**:
1. Faça uma alteração em um produto no Bling
2. Aguarde até as 3h da manhã (ou simule acessando `/api/cron/reconciliar`)
3. Verifique em Supabase:
   ```sql
   SELECT * FROM bling_sync_log WHERE tipo = 'incremental' 
   ORDER BY created_at DESC LIMIT 1;
   ```

**Resultado esperado**: ✅ Sincronização registrada com sucesso

---

## ✅ Teste 9: Tratamento de Erros

**Objetivo**: Verificar se erros são tratados graciosamente

**Passos**:
1. Simule um erro de conexão (offline no navegador)
2. Tente acessar `/produtos`
3. Deve exibir mensagem de erro clara
4. Reconecte e recarregue
5. Dados devem voltar a carregar

**Resultado esperado**: ✅ Erros exibidos de forma clara

---

## ✅ Teste 10: Segurança

**Objetivo**: Verificar se a autenticação está protegendo as rotas

**Passos**:
1. Abra incógnito (sem estar logado)
2. Acesse `/produtos` diretamente
3. Deve redirecionar para `/auth/login`
4. Tente acessar `/api/bling/sync-inicial` sem token
5. Deve retornar erro 401

**Resultado esperado**: ✅ Rotas protegidas funcionando

---

## 📊 Checklist de Testes

- [ ] Teste 1: Autenticação
- [ ] Teste 2: OAuth Bling
- [ ] Teste 3: Sync Inicial
- [ ] Teste 4: Busca e Filtros
- [ ] Teste 5: Detalhes do Produto
- [ ] Teste 6: Webhooks
- [ ] Teste 7: Cron Token (3h)
- [ ] Teste 8: Cron Reconciliação
- [ ] Teste 9: Tratamento de Erros
- [ ] Teste 10: Segurança

---

## 🔧 Como Simular Crons Localmente

Se quiser testar crons sem esperar 3 horas:

```bash
# Renovar token
curl https://seu-dominio.vercel.app/api/cron/refresh-token

# Reconciliar
curl https://seu-dominio.vercel.app/api/cron/reconciliar
```

---

## 🐛 Se Algo Falhar

1. **Verifique logs na Vercel**:
   - Vá para seu projeto → Deployments → Clique no último → Logs

2. **Verifique logs no Supabase**:
   ```sql
   SELECT * FROM bling_sync_log ORDER BY created_at DESC LIMIT 20;
   ```

3. **Verifique variáveis de ambiente**:
   - Vercel → Settings → Environment Variables
   - Todas as 7 variáveis estão presentes?

4. **Teste a API do Bling**:
   - Os tokens ainda são válidos?
   - O app está ativo no painel do Bling?

---

**Depois de passar em todos os testes, o sistema está pronto para produção! 🚀**
