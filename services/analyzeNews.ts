import type { NewsAnalysis } from '../src/types'

export async function analyzeNews(url: string): Promise<NewsAnalysis> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => ({})) as Partial<NewsAnalysis> & { detail?: string }
  if (!response.ok) throw new Error(payload.detail || 'Não foi possível analisar esta página. Tente novamente.')
  if (!payload.title || !payload.sourceUrl || !Array.isArray(payload.checklist) || !Array.isArray(payload.keyPoints) || !Array.isArray(payload.attentionPoints) || !payload.naiveBayes || !payload.naiveBayes.textDistribution || !Array.isArray(payload.evidence)) {
    throw new Error('A resposta do serviço de análise veio incompleta.')
  }
  return payload as NewsAnalysis
}
