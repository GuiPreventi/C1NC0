import { useEffect, useState, type FormEvent } from 'react'
import { Check, CheckCircle2, MessageCircle, Send, Star, X } from 'lucide-react'
import { feedbackIsConfigured, submitFeedback } from '../services/feedback'

const clarityOptions = [
  { value: 'Sim, foi fácil', label: 'Sim, foi fácil' },
  { value: 'Em parte', label: 'Em parte' },
  { value: 'Não foi fácil', label: 'Não foi fácil' },
] as const

const helpfulOptions = [
  { value: 'Resumo e dados da matéria', label: 'Resumo e dados da matéria' },
  { value: 'Trechos para conferir', label: 'Trechos para conferir' },
  { value: 'Checklist de conferência', label: 'Checklist de conferência' },
  { value: 'Outro recurso', label: 'Outro recurso' },
] as const

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [satisfaction, setSatisfaction] = useState(0)
  const [clarity, setClarity] = useState<(typeof clarityOptions)[number]['value'] | ''>('')
  const [helpful, setHelpful] = useState<(typeof helpfulOptions)[number]['value'] | ''>('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const reset = () => {
    setSatisfaction(0)
    setClarity('')
    setHelpful('')
    setComment('')
    setError('')
    setSent(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (satisfaction < 1 || !clarity) {
      setError('Escolha uma nota e responda se foi fácil entender os resultados.')
      return
    }
    setSending(true)
    setError('')
    try {
      await submitFeedback({
        satisfaction,
        satisfaction_question: 'Como foi sua experiência geral?',
        satisfaction_answer: `${satisfaction} de 5`,
        clarity_question: 'Foi fácil entender os resultados?',
        clarity,
        helpful_section_question: 'O que mais ajudou?',
        helpful_section: helpful || null,
        comment_question: 'O que podemos melhorar?',
        comment: comment.trim() || null,
        page_path: window.location.pathname,
      })
      setSent(true)
    } catch {
      setError(feedbackIsConfigured
        ? 'Não foi possível enviar agora. Confira sua conexão e tente novamente.'
        : 'O formulário ainda não está conectado. Tente novamente mais tarde.')
    } finally {
      setSending(false)
    }
  }

  return <>
    <div className="feedback-dock">
      <button className="feedback-trigger" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="feedback-panel">
        {open ? <X size={17} /> : <MessageCircle size={17} />}
        <span>{open ? 'FECHAR' : 'ENVIAR FEEDBACK'}</span>
      </button>
    </div>

    {open && <section className="feedback-panel" id="feedback-panel" role="dialog" aria-modal="false" aria-labelledby="feedback-title">
      <div className="feedback-panel-head">
        <div><span className="feedback-eyebrow"><span /> UM MINUTO, SEU</span><h2 id="feedback-title">Conta pra gente<span>.</span></h2></div>
        <button type="button" className="feedback-close" onClick={() => setOpen(false)} aria-label="Fechar feedback"><X size={17} /></button>
      </div>
      {sent ? <div className="feedback-success" role="status"><span className="feedback-success-icon"><CheckCircle2 size={22} /></span><h3>Obrigado por compartilhar.</h3><p>Sua resposta foi recebida e vai nos ajudar a melhorar a experiência.</p><button type="button" className="feedback-done" onClick={() => { setOpen(false); reset() }}>FECHAR <Check size={14} /></button></div> : <form className="feedback-form" onSubmit={handleSubmit}>
        <p className="feedback-intro">Queremos saber como foi usar a C1NC0. Não pedimos seu nome nem seu e-mail.</p>
        <fieldset className="feedback-rating"><legend>Como foi sua experiência geral? <span>*</span></legend><div className="rating-buttons" role="group" aria-label="Nota de 1 a 5">
          {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" className={satisfaction >= value ? 'selected' : ''} onClick={() => setSatisfaction(value)} aria-label={`${value} de 5`} aria-pressed={satisfaction === value}><Star size={19} fill={satisfaction >= value ? 'currentColor' : 'none'} /><span>{value}</span></button>)}
        </div><div className="rating-caption"><span>Poderia melhorar</span><span>Foi ótima</span></div></fieldset>
        <fieldset className="feedback-clarity"><legend>Foi fácil entender os resultados? <span>*</span></legend><div className="clarity-options">{clarityOptions.map(option => <label key={option.value} className={clarity === option.value ? 'chosen' : ''}><input type="radio" name="clarity" value={option.value} checked={clarity === option.value} onChange={() => setClarity(option.value)} /><span>{option.label}</span></label>)}</div></fieldset>
        <label className="feedback-select-label" htmlFor="feedback-helpful">O que mais ajudou?</label><select id="feedback-helpful" value={helpful} onChange={event => setHelpful(event.target.value as typeof helpful)}><option value="">Escolha uma opção (opcional)</option>{helpfulOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <label className="feedback-select-label" htmlFor="feedback-comment">O que podemos melhorar? <span>opcional</span></label><textarea id="feedback-comment" value={comment} onChange={event => setComment(event.target.value.slice(0, 1200))} placeholder="Conte pra gente, se quiser..." rows={3} />
        <div className="feedback-submit-row"><span>{comment.length}/1200</span><button className="feedback-submit" type="submit" disabled={sending || !feedbackIsConfigured}>{sending ? 'ENVIANDO...' : <>ENVIAR RESPOSTA <Send size={14} /></>}</button></div>
        {!feedbackIsConfigured && <p className="feedback-config-note">O envio será ativado assim que o banco de feedback for conectado.</p>}
        {error && <p className="feedback-error" role="alert">{error}</p>}
        <p className="feedback-privacy">Suas respostas são usadas apenas para melhorar a ferramenta.</p>
      </form>}
    </section>}
  </>
}
