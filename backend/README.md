# Backend C1NC0

## Modelo usado pelo site

A API carrega os artefatos Naive Bayes já treinados em `backend/models/`; iniciar o site não executa treinamento. São usadas duas leituras da notícia:

- `multinomial_nb.joblib` e `tfidf_vectorizer.joblib`: comparam o título e o texto da matéria com os padrões de texto aprendidos.
- `gaussian_nb_pipeline.joblib`: recebe um vetor de 19 posições para características da página. A API calcula sinais como links externos, diversidade lexical e termos do título presentes no texto. As características não calculadas ficam marcadas como ausentes para o pipeline tratar.

As duas leituras da API atual funcionam com as dependências de `backend/requirements.txt`. A extração de características na rota de análise usa o HTML da matéria e regras de tokenização.

`model_metadata.json` acompanha os artefatos. O painel apresenta as classes como padrões encontrados no conjunto de notícias, não como confirmação factual. A avaliação do notebook registra possível sobreposição de conteúdos entre exemplos, então os resultados devem ser interpretados como experimentais.

Não remova os arquivos `.joblib` ou `model_metadata.json`. Os artefatos vieram de `ResidenciaIA-feature-c1nc0-etapa-a-interface-web-v1.zip`.

## Instalação e execução

Na raiz do projeto, no PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm.cmd install
npm.cmd run dev
```

O script inicia a API em uma porta livre entre 8000 e 8010 e o Vite em `http://127.0.0.1:5173`.

As versões de scikit-learn e joblib em `requirements.txt` correspondem às usadas para empacotar os modelos. Se já houver uma `.venv` com versões diferentes, atualize as dependências antes de iniciar a API.

## Feedback e Supabase

O formulário grava respostas na tabela `public.site_feedback`, com RLS habilitado e apenas inserção anônima liberada. A configuração está em `supabase/feedback.sql`; instruções de conexão estão em `supabase/README.md`.
