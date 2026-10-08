export type FeedbackSubmission = {
  satisfaction: number
  satisfaction_question: string
  satisfaction_answer: string
  clarity_question: string
  clarity: 'Sim, foi fácil' | 'Em parte' | 'Não foi fácil'
  helpful_section_question: string
  helpful_section: 'Resumo e dados da matéria' | 'Trechos para conferir' | 'Checklist de conferência' | 'Outro recurso' | null
  comment_question: string
  comment: string | null
  page_path: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '')
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()

export const feedbackIsConfigured = Boolean(supabaseUrl && supabaseKey)

export async function submitFeedback(feedback: FeedbackSubmission) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('O envio de feedback ainda não está conectado.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/site_feedback`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(feedback),
  })

  if (!response.ok) {
    throw new Error('Não foi possível enviar agora. Tente novamente em instantes.')
  }
}
