# C1NC0

O C1NC0 é uma aplicação web de apoio à leitura crítica de notícias. Ao receber o link de uma matéria, extrai informações da página e mostra quais elementos merecem ser conferidos, como autoria, data de publicação, sites citados e a relação entre título e texto.

## Como funciona

1. A interface envia a URL para a API. O backend busca a página e extrai título, parágrafos, metadados e links do HTML disponível.
2. A API aplica dois modelos Naive Bayes já treinados. O **Multinomial Naive Bayes** analisa o título e o corpo com TF-IDF. O **Gaussian Naive Bayes** usa um vetor com 19 posições para características estruturais e linguísticas. A versão atual calcula os sinais disponíveis, como contagem de palavras, diversidade lexical e links externos, e marca como ausentes os que não extrai.
3. A interface apresenta a leitura dos modelos, os pontos de atenção e um checklist para o leitor. O indicador de coerência mede a porcentagem de termos distintos do título que também aparecem no texto. Ele mede sobreposição de palavras.

Os percentuais expressam os padrões aprendidos pelos modelos. A aplicação não confirma fatos, não consulta o conteúdo das fontes citadas e não apresenta probabilidades calibradas de veracidade. Uma página inacessível ou com pouco texto disponível pode limitar a análise.

## Avaliação dos modelos

O [arquivo de metadados](backend/models/model_metadata.json) registra uma divisão estratificada de 80% para treino e 20% para teste, com semente 42. Precisão, recall e F1 na tabela são da classe `fake`.

| Modelo | Acurácia | Precisão | Recall | F1 |
| --- | ---: | ---: | ---: | ---: |
| Multinomial Naive Bayes com TF-IDF | 98,93% | 98,60% | 97,24% | 97,91% |
| Gaussian Naive Bayes | 73,16% | 47,67% | 40,28% | 43,66% |

A [documentação do backend](backend/README.md) registra possível sobreposição de conteúdo entre exemplos. Os números são resultados experimentais da divisão documentada. A execução local usa os arquivos `.joblib` versionados. Os scripts `train_model.py` e `evaluate_model.py` pertencem ao experimento separado de detecção de títulos atípicos com LOF.

## Executar localmente

Instale Git, Python 3.12 ou superior e Node.js com npm. Depois, clone o repositório:

```bash
git clone https://github.com/GuiPreventi/C1NC0.git
cd C1NC0
```

**Linux ou macOS**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm ci
npm run dev
```

**Windows (PowerShell)**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm.cmd ci
npm.cmd run dev
```

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173) ou use o endereço exibido pelo Vite. O comando inicia a interface e a API, que usa uma porta livre entre 8000 e 8010. Para gerar o frontend de produção em `dist/`, execute `npm run build`.

## API

| Método e rota | Função |
| --- | --- |
| `GET /api/health` | Informa o status da API e a disponibilidade dos arquivos do modelo. |
| `POST /api/analyze` | Recebe um JSON com o campo `url` e devolve a análise da matéria. |

O Vite encaminha as chamadas de `/api` para o backend durante o desenvolvimento.

## Estrutura do repositório

| Caminho | Responsabilidade |
| --- | --- |
| [`src/`](src/) | Interface em React e TypeScript, com Vite, Framer Motion e Three.js. |
| [`services/analyzeNews.ts`](services/analyzeNews.ts) | Cliente da API de análise. |
| [`backend/app.py`](backend/app.py) | API em FastAPI, coleta com HTTPX e extração de conteúdo com Beautiful Soup. |
| [`backend/naive_bayes.py`](backend/naive_bayes.py) | Extração de características e inferência com scikit-learn. |
| [`backend/models/`](backend/models/) | Modelos, vetorizador TF-IDF e metadados da avaliação. |
| [`supabase/`](supabase/) | Configuração opcional do formulário de feedback. |

Para ativar o formulário de feedback, siga as [instruções de configuração](supabase/README.md).
