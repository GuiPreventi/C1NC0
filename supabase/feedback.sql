create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  satisfaction smallint not null check (satisfaction between 1 and 5),
  satisfaction_question text not null default 'Como foi sua experiência geral?',
  satisfaction_answer text not null,
  clarity_question text not null default 'Foi fácil entender os resultados?',
  clarity text not null check (clarity in ('Sim, foi fácil', 'Em parte', 'Não foi fácil')),
  helpful_section_question text not null default 'O que mais ajudou?',
  helpful_section text check (helpful_section is null or helpful_section in ('Resumo e dados da matéria', 'Trechos para conferir', 'Checklist de conferência', 'Outro recurso')),
  comment_question text not null default 'O que podemos melhorar?',
  comment text check (comment is null or char_length(comment) <= 1200),
  page_path text not null check (char_length(page_path) <= 500)
);

alter table public.site_feedback enable row level security;
revoke all on table public.site_feedback from anon, authenticated;
grant insert on table public.site_feedback to anon;

drop policy if exists "Anyone can submit feedback" on public.site_feedback;
create policy "Anyone can submit feedback"
  on public.site_feedback
  for insert
  to anon
  with check (
    satisfaction between 1 and 5
    and satisfaction_question = 'Como foi sua experiência geral?'
    and satisfaction_answer = satisfaction::text || ' de 5'
    and clarity_question = 'Foi fácil entender os resultados?'
    and clarity in ('Sim, foi fácil', 'Em parte', 'Não foi fácil')
    and helpful_section_question = 'O que mais ajudou?'
    and (helpful_section is null or helpful_section in ('Resumo e dados da matéria', 'Trechos para conferir', 'Checklist de conferência', 'Outro recurso'))
    and comment_question = 'O que podemos melhorar?'
    and (comment is null or char_length(comment) <= 1200)
    and char_length(page_path) <= 500
  );
