# Backend C1NC0

## Modelo usado pelo site

A API carrega os artefatos Naive Bayes já treinados em `backend/models/`; iniciar o site não executa treinamento. São usadas duas leituras da notícia:

- `multinomial_nb.joblib` e `tfidf_vectorizer.joblib`: comparam o título e o texto da matéria com os padrões de texto aprendidos.
- `gaussian_nb_pipeline.joblib`: observa 19 características de estrutura e linguagem da página. O pacote de português usado nessa leitura está em `backend/models/pt_core_news_sm/`.

A leitura do texto funciona sem spaCy. Para ativar também a leitura das características da página, instale o extra opcional com `python -m pip install -r backend/requirements-page-analysis.txt`. Sem esse pacote, o site continua iniciando e informa que a leitura complementar está indisponível.

`model_metadata.json` acompanha os artefatos. O painel apresenta as classes como padrões encontrados no conjunto de notícias, não como confirmação factual. A avaliação do notebook registra possível sobreposição de conteúdos entre exemplos, então os resultados devem ser interpretados como experimentais.

Não remova os arquivos `.joblib` ou `model_metadata.json`. A pasta `pt_core_news_sm` é necessária junto com spaCy para habilitar a leitura complementar. Os artefatos vieram de `ResidenciaIA-feature-c1nc0-etapa-a-interface-web-v1.zip`.

## Instalação e execução

Na raiz do projeto, no PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm.cmd install
npm.cmd run dev
```

Para habilitar a leitura complementar, execute também `.\.venv\Scripts\python.exe -m pip install -r backend\requirements-page-analysis.txt`. O script inicia a API em uma porta livre entre 8000 e 8010 e o Vite em `http://127.0.0.1:5173`.

As versões de scikit-learn e joblib em `requirements.txt` correspondem às usadas para empacotar os modelos. Se já houver uma `.venv` com versões diferentes, atualize as dependências antes de iniciar a API.

## Feedback e Supabase

O formulário grava respostas na tabela `public.site_feedback`, com RLS habilitado e apenas inserção anônima liberada. A configuração está em `supabase/feedback.sql`; instruções de conexão estão em `supabase/README.md`.
