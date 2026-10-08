# Conectar o feedback ao Supabase

1. No painel do projeto Supabase, abra **SQL Editor** e execute `feedback.sql`.
2. Copie `.env.example` para `.env.local` na raiz do C1NC0.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL do projeto e a chave `sb_publishable_...` exibidas nas configurações de API do Supabase. Se o projeto só tiver a chave legada, use `VITE_SUPABASE_ANON_KEY`.
4. Reinicie o Vite para carregar as variáveis.

A tabela permite inserções anônimas com validações e RLS ativo. Leitura pública fica bloqueada. **Nunca coloque a chave `service_role` no frontend.**
