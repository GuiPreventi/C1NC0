import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, FileText, Fingerprint, Link2, LoaderCircle, Orbit, ScanSearch, Shield, Sparkles, Waypoints, X } from 'lucide-react'
import AIVisualization from './components/AIVisualization'
import AnalysisLoading from './components/AnalysisLoading'
import FeedbackWidget from './components/FeedbackWidget'
import TransparencyNotice from './components/TransparencyNotice'
import './naiveBayesResults.css'
import { analyzeNews } from '../services/analyzeNews'
import type { Evidence, ModelDistribution as DistributionValues, NewsAnalysis, NaiveBayesResult } from './types'

function Header() { return <header className="site-header"><a href="#home" className="brand" aria-label="C1NC0 início"><span className="brand-mark"><span /><span /><span /><span /><span /></span><span>C1NC0</span></a><nav><a href="#metodo">Como funciona</a><a href="#sobre">Sobre</a></nav><div className="ai-status"><span className="status-dot" />LEITURA ASSISTIDA</div></header> }
function formatDateParts(raw: string) { const hasTime = /T\d{2}:\d{2}|\d{1,2}:\d{2}/.test(raw); let date: Date; const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (dateOnly) date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])); else date = new Date(raw); if (Number.isNaN(date.getTime())) return { date: raw, time: '' }; const dateText = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', ''); const timeText = hasTime ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date) : ''; return { date: dateText, time: timeText } }
function formatDateEvidence(item: Evidence, text: string) { const prefix = 'Data que aparece na página: '; if (item.icon !== 'date' || !text.startsWith(prefix)) return text; const formatted = formatDateParts(text.slice(prefix.length).replace(/\.$/, '')); return `${prefix}${formatted.date}${formatted.time ? ` às ${formatted.time}` : ''}.` }
function checklistStorageKey(url: string) { let hash = 2166136261; for (let index = 0; index < url.length; index++) hash = Math.imul(hash ^ url.charCodeAt(index), 16777619); return `c1nc0-checklist-${(hash >>> 0).toString(36)}` }
function Hero() { return <section className="hero" id="home"><div className="hero-copy"><div className="kicker"><span className="kicker-line" /> FERRAMENTA DE LEITURA CRÍTICA <span className="kicker-id">Nº 001</span></div><h1>Informação merece<br />ser <span>investigada.</span></h1><p>Explore os indícios por trás de uma notícia.<br className="desktop-break" /> Uma leitura mais atenta começa com as perguntas certas.</p><a className="hero-link" href="#analisador">Começar análise <ArrowDown size={14} /></a></div><div className="hero-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-crosshair">+</div><AIVisualization /><span className="art-caption"><span className="pulse-dot" /> NÚCLEO DE ANÁLISE <span>01 / 05</span></span></div><div className="hero-index">01 <span /> UMA CAMADA A MAIS</div></section> }
function URLAnalyzer({ onAnalyze, busy }: { onAnalyze: (url: string) => void; busy: boolean }) { const [url, setUrl] = useState(''); const [error, setError] = useState(''); const submit = (event: FormEvent) => { event.preventDefault(); try { const parsed = new URL(url.trim()); if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) throw new Error(); setError(''); onAnalyze(parsed.toString()) } catch { setError('Insira um endereço completo, incluindo https://, para começar.') } }; return <section className="analyzer-wrap" id="analisador"><div className="section-marker"><span>01</span><span className="marker-rule" /> URL DA NOTÍCIA</div><div className="analyzer-head"><div><h2>Por onde começamos?</h2><p>Insira o link de uma matéria que você quer observar mais de perto.</p></div><span className="input-index">LINK_01</span></div><form className={`url-form ${error ? 'has-error' : ''}`} onSubmit={submit} noValidate><Link2 className="input-icon" size={18} /><label className="sr-only" htmlFor="news-url">URL da notícia</label><input id="news-url" type="url" placeholder="Cole aqui o link da notícia..." value={url} onChange={e => { setUrl(e.target.value); setError('') }} disabled={busy} aria-describedby={error ? 'url-error' : undefined} />{url && <button type="button" className="clear-button" onClick={() => setUrl('')} aria-label="Limpar endereço"><X size={15} /></button>}<button className="analyze-button" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={15} /> LENDO</> : <>ANALISAR <ArrowRight size={15} /></>}</button></form>{error && <p id="url-error" className="form-error" role="alert">{error}</p>}<div className="input-foot"><span><Shield size={13} /> Analisamos apenas informações públicas da página.</span><span>COLE O LINK DE UMA NOTÍCIA</span></div></section> }
const iconMap = { coherence: FileText, links: Link2, origin: Fingerprint, date: Clock3 }
function EvidenceCard({ item, index }: { item: Evidence; index: number }) { const [expanded, setExpanded] = useState(false); const Icon = iconMap[item.icon]; return <motion.article className={`evidence-card tone-${item.tone} ${expanded ? 'expanded' : ''}`} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: .45, delay: index * .08 }}><button className="card-main" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><span className="card-topline"><span className="card-icon"><Icon size={16} /></span><span className="card-number">OBS. 0{index + 1}</span><ChevronDown className="expand-icon" size={15} /></span><span className="card-title">{item.title}</span><span className="card-detail">{item.detail}</span><span className="card-value">{item.value}<ArrowUpRight size={13} /></span></button><AnimatePresence initial={false}>{expanded && <motion.div className="card-notes" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><ul>{item.bullets.map(b => <li key={b}>{formatDateEvidence(item, b)}</li>)}</ul></motion.div>}</AnimatePresence></motion.article> }
function NewsSummary({ result }: { result: NewsAnalysis }) {
  const publication = formatDateParts(result.date)
  const [imageFailed, setImageFailed] = useState(false)
  return <motion.section className="summary-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
    <div className={`summary-image ${result.imageUrl && !imageFailed ? 'has-image' : ''}`}>
      {result.imageUrl && !imageFailed && <img className="summary-photo" src={result.imageUrl} alt={`Imagem principal da notícia: ${result.title}`} onError={() => setImageFailed(true)} />}
      <div className="image-grid" />
      <span className="image-tag"><ScanSearch size={12} /> {result.imageUrl && !imageFailed ? 'IMAGEM DA NOTÍCIA' : 'PÁGINA ANALISADA'}</span>
      {(!result.imageUrl || imageFailed) && <div className="image-center"><Orbit size={36} strokeWidth={1} /><span>c1 / scan</span></div>}
    </div>
    <div className="summary-content"><div className="summary-label"><span className="live-mark" /> RESUMO DA NOTÍCIA <span className="summary-demo">CONTEÚDO DA PÁGINA</span></div><h3>{result.title}</h3><p>{result.summary}</p><div className="summary-meta"><span><span className="meta-key">SITE</span>{result.domain}</span><span className="publication-meta"><span className="meta-key">PUBLICADA EM</span><span className="publication-values"><CalendarDays size={14} /><time dateTime={result.date}>{publication.date}</time>{publication.time && <span className="publication-time"><Clock3 size={13} /><time dateTime={result.date}>{publication.time}</time></span>}</span></span><span><span className="meta-key">AUTORIA</span>{result.author ?? 'Não identificada'}</span></div></div>
  </motion.section>
}
function EvidenceOverview({ result }: { result: NewsAnalysis }) { return <section className="results-section"><div className="results-heading"><div><div className="section-marker"><span>02</span><span className="marker-rule" /> LEITURA DOS ELEMENTOS</div><h2>O que encontramos<span className="heading-period">.</span></h2></div><span className="cards-hint">SELECIONE UM CARTÃO<br />PARA EXPLORAR OS DETALHES <ArrowDown size={13} /></span></div><NewsSummary result={result} /><div className="evidence-grid">{result.evidence.map((item, i) => <EvidenceCard key={item.title} item={item} index={i} />)}</div></section> }
const classLabel = (value: 'fake' | 'true') => value === 'fake' ? 'Padrões mais próximos de notícias marcadas como falsas' : 'Padrões mais próximos de notícias marcadas como verdadeiras'
const featureDirectionLabel = (value: 'fake' | 'true' | 'neutral') => value === 'fake' ? 'Mais próximo de notícias marcadas como falsas' : value === 'true' ? 'Mais próximo de notícias marcadas como verdadeiras' : 'Sem indicação para um dos lados'
const featureDescriptions: Record<string, string> = {
  'Links externos': 'Observa se o texto aponta para páginas fora do próprio site.',
  'Sites externos citados': 'Observa a variedade de sites apontados pela matéria.',
  'Palavras identificadas': 'Representa a extensão do conteúdo que pôde ser lido.',
  'Palavras no texto': 'Considera o volume de texto analisado junto ao título.',
  'Palavras diferentes': 'Observa a variedade de termos usados na matéria.',
  'Verbos': 'Observa como ações e acontecimentos são descritos.',
  'Substantivos e nomes': 'Considera a presença de pessoas, lugares e assuntos nomeados.',
  'Adjetivos': 'Observa palavras usadas para caracterizar pessoas, fatos ou situações.',
  'Advérbios': 'Considera palavras que dão circunstância ou intensidade às afirmações.',
  'Pronomes': 'Observa como pessoas e elementos são retomados no texto.',
  'Verbos de possibilidade ou ordem': 'Observa construções de hipótese, possibilidade ou orientação.',
  'Palavras em maiúsculas': 'Considera o uso de letras maiúsculas para dar destaque.',
  'Caracteres do texto': 'Representa a extensão total do conteúdo analisado.',
  'Palavras por frase, em média': 'Observa se as frases tendem a ser mais curtas ou mais longas.',
  'Letras por palavra, em média': 'Observa o comprimento médio das palavras usadas.',
  'Indicação de erros de escrita': 'Este aspecto não pôde ser medido nesta análise.',
  'Adjetivos e advérbios em relação a verbos e substantivos': 'Observa a proporção entre palavras descritivas e palavras que nomeiam ou indicam ações.',
  'Variedade de palavras': 'Compara a variedade de termos relevantes usados no conteúdo.',
  'Palavras do título presentes no texto': 'Observa se os termos do título reaparecem no conteúdo da matéria.',
}
function FeatureSignal({ item }: { item: NaiveBayesResult['featureEvidence'][number] }) {
  const state = item.available ? item.direction : 'unavailable'
  const resultLabel = item.available ? featureDirectionLabel(item.direction) : 'Não foi possível avaliar este aspecto'
  return <article className="nb-signal-row">
    <div className="nb-signal-copy"><strong>{item.name}</strong><p>{featureDescriptions[item.name] ?? 'Aspecto observado pelo modelo na matéria.'}</p></div>
    <div className={`nb-signal-meter signal-${state}`} role="img" aria-label={resultLabel}>
      <span className="signal-side signal-left">Mais próximo de notícias<br />marcadas como falsas</span>
      <span className="signal-side signal-center">Sem indicação</span>
      <span className="signal-side signal-right">Mais próximo de notícias<br />marcadas como verdadeiras</span>
      <i />
    </div>
    <span className={`nb-signal-result signal-result-${state}`}>{resultLabel}</span>
  </article>
}
function ModelDistribution({ distribution, center, description, metrics }: { distribution: DistributionValues; center: string; description: string; metrics: string[] }) {
  const truePercent = distribution.true
  const fakePercent = distribution.fake
  return <div className="nb-distribution-card">
    <div className="nb-model-donut" style={{ background: `conic-gradient(#78d6ad 0 ${truePercent}%, #e2a77d ${truePercent}% 100%)` }} role="img" aria-label={`Leitura automática: ${truePercent}% de sinais associados a notícias consideradas verdadeiras e ${fakePercent}% a notícias consideradas falsas`}>
      <div className="nb-model-donut-center"><span>LEITURA DE</span><strong>{center}</strong></div>
    </div>
    <div className="nb-model-explanation">
      <div className="nb-model-legend">
        <div><i className="legend-true" /><span><strong>{truePercent}%</strong><small>Sinais associados a notícias consideradas verdadeiras</small></span></div>
        <div><i className="legend-fake" /><span><strong>{fakePercent}%</strong><small>Sinais associados a notícias consideradas falsas</small></span></div>
      </div>
      <p>{description}</p>
      {metrics.length > 0 && <ul>{metrics.map(metric => <li key={metric}>{metric}</li>)}</ul>}
    </div>
  </div>
}
function PageSignalsChart({ metrics }: { metrics: NonNullable<NaiveBayesResult['metricValues']> }) {
  const rows = [
    { label: 'Termos do título encontrados no texto', value: metrics.titleCoherence, display: `${metrics.titleCoherence}%` },
    { label: 'Palavras diferentes', value: metrics.lexicalDiversity, display: `${metrics.lexicalDiversity}%` },
    { label: 'Links sem destino utilizável', value: metrics.undestinedLinkRate, display: `${metrics.undestinedLinkRate}%` },
  ]
  return <div className="nb-page-signals-card">
    <div className="nb-page-signals-chart" role="img" aria-label={rows.map(row => `${row.label}: ${row.display}`).join('. ')}>
      {rows.map(row => <div className="nb-page-signal" key={row.label}><div><span>{row.label}</span><strong>{row.display}</strong></div><div className="nb-page-signal-track"><i style={{ width: `${Math.max(0, Math.min(row.value, 100))}%` }} /></div></div>)}
    </div>
    <div className="nb-model-explanation"><p>Este gráfico mostra características observadas diretamente na página. Uma barra maior indica mais presença daquele aspecto; isso, sozinho, não determina se a notícia é verdadeira ou falsa.</p><ul><li>{metrics.undestinedLinks} de {metrics.totalLinks} links não têm um destino utilizável.</li><li>{metrics.wordCount} palavras foram identificadas no título e no conteúdo.</li></ul></div>
  </div>
}
function AttentionMenu({ points }: { points: NewsAnalysis['attentionPoints'] }) {
  return <details className="nb-attention-menu" open>
    <summary><span><small>PONTOS DE ATENÇÃO DA PÁGINA</small><strong>O que vale conferir nesta notícia</strong></span><ChevronDown size={16} /></summary>
    <p>Observações baseadas no conteúdo e nos links que a página apresenta. Elas não são um veredito sobre a notícia.</p>
    <ul>{points.map((point, index) => <li key={`${point.title}-${index}`}><span className="attention-marker">0{index + 1}</span><div><strong>{point.title}</strong><p>{point.detail}</p></div></li>)}</ul>
  </details>
}
function NaiveBayesOverview({ result }: { result: NewsAnalysis }) {
  const analysis = result.naiveBayes
  const [activeChart, setActiveChart] = useState<'pageSignals' | 'links' | 'titleContent'>('pageSignals')
  const metrics = analysis.metricValues
  const chartOptions = [
    { id: 'pageSignals' as const, label: 'Sinais da página' },
    { id: 'links' as const, label: 'Links e fontes' },
    { id: 'titleContent' as const, label: 'Título e conteúdo' },
  ]
  const chartContent = activeChart === 'links' ? {
    distribution: analysis.metricDistributions?.links ?? analysis.textDistribution,
    center: 'LINKS',
    description: 'Mostra como a quantidade de links externos e de sites diferentes foi avaliada nesta notícia. Links sem destino aparecem como ponto de atenção, mas não são usados nessa leitura.',
    metrics: metrics ? [`${metrics.externalLinks} links externos encontrados`, `${metrics.externalDomains} sites externos diferentes`, `${metrics.undestinedLinks} links sem destino utilizável`] : [],
  } : {
    distribution: analysis.metricDistributions?.titleContent ?? analysis.textDistribution,
    center: 'TEXTO',
    description: 'Mostra como o tamanho da matéria, as palavras diferentes e a presença de termos do título no conteúdo foram avaliados nesta notícia.',
    metrics: metrics ? [`${metrics.wordCount} palavras identificadas`, `${metrics.titleCoherence}% dos termos do título aparecem no texto`, `${metrics.lexicalDiversity}% de palavras diferentes no texto`] : [],
  }
  const activeChartAvailable = activeChart === 'pageSignals' ? metrics !== null : analysis.metricDistributions !== null
  return <section className="distribution-section nb-section" id="metodo">
    <div className="distribution-copy"><div className="section-marker"><span>03</span><span className="marker-rule" /> RESULTADO DA ANÁLISE</div><h2>O que observar<br /><span>na notícia.</span></h2><p>Explore indicadores da página e veja como links e conteúdo foram avaliados para esta notícia.</p><div className="distribution-disclaimer"><CircleHelp size={15} /><span>Os gráficos ajudam a observar sinais; não confirmam se a notícia é verdadeira ou falsa.</span></div></div>
    <div className="distribution-chart nb-comparison">
      <div className="nb-result-intro"><span>INDICADORES DA NOTÍCIA</span><p>Escolha um aspecto para explorar os dados encontrados nesta página.</p></div>
      <div className="nb-chart-tabs" role="tablist" aria-label="Gráficos da análise">
        {chartOptions.map(option => <button key={option.id} type="button" role="tab" aria-selected={activeChart === option.id} className={activeChart === option.id ? 'active' : ''} onClick={() => setActiveChart(option.id)}>{option.label}</button>)}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={activeChart} role="tabpanel" className="nb-chart-panel" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2 }}>
          {activeChartAvailable ? activeChart === 'pageSignals' ? <PageSignalsChart metrics={metrics!} /> : <ModelDistribution {...chartContent} /> : <div className="nb-chart-unavailable">A leitura deste aspecto não ficou disponível para esta notícia.</div>}
        </motion.div>
      </AnimatePresence>
      <p className="nb-distribution-note">Nos gráficos de links e de título/conteúdo, os percentuais mostram a leitura automática desses aspectos. Eles não indicam a chance real de a notícia ser verdadeira ou falsa.</p>
      <AttentionMenu points={result.attentionPoints} />
      {analysis.pageReadingAvailable && <div className="nb-reading-grid nb-single-reading"><article><span>CARACTERÍSTICAS DA ESCRITA</span><strong>{classLabel(analysis.pageClass!)}</strong><p>Esta leitura considera aspectos de linguagem e da construção da matéria.</p></article></div>}
      {analysis.pageReadingAvailable ? <>
        <div className={`nb-agreement ${analysis.agreement ? 'is-agree' : 'is-different'}`}><span className="live-mark" />{analysis.agreement ? 'As duas leituras apontam para padrões semelhantes.' : 'As leituras encontraram padrões diferentes. Vale observar os aspectos abaixo.'}</div>
        <div className="nb-signal-intro"><h3>Como cada aspecto se relaciona com a base</h3><p>Cada marcador mostra com qual grupo de exemplos aquele aspecto mais se parece. Ele não representa uma porcentagem nem a força de uma prova.</p><div className="nb-signal-legend"><span><i className="legend-fake" />Exemplos marcados como falsos</span><span><i className="legend-neutral" />Sem indicação</span><span><i className="legend-true" />Exemplos marcados como verdadeiros</span></div></div>
        <div className="nb-signal-list">{analysis.featureEvidence.filter(item => item.available).map(item => <FeatureSignal item={item} key={item.name} />)}</div>
        </> : null}
      <p className="nb-disclaimer">{analysis.disclaimer}</p>
    </div>
  </section>
}
function ReflectionSections({ result }: { result: NewsAnalysis }) {
  const storageKey = checklistStorageKey(result.sourceUrl)
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved as Record<string, boolean> : {} } catch { return {} }
  })
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(checked)) } catch { /* Keep checklist usable if browser storage is unavailable. */ } }, [storageKey, checked])
  const checkedCount = result.checklist.filter(item => checked[item.id]).length
  const progress = result.checklist.length ? checkedCount / result.checklist.length * 100 : 0
  return <section className="reflection-grid">
    <div className="unknowns article-review">
      <div className="reflection-top"><span className="reflection-symbol"><CircleHelp size={17} /></span><span>04 / INFORMAÇÕES DA MATÉRIA</span></div>
      <h3>Trechos para conferir<span>.</span></h3>
      <p>Selecionamos afirmações, números ou falas que você pode comparar com as fontes originais.</p>
      {result.keyPoints.length ? <ol className="article-points">{result.keyPoints.map((point, index) => <li key={`${index}-${point}`}><span>0{index + 1}</span><blockquote>{point}</blockquote></li>)}</ol> : <p className="no-points">Não foi possível extrair trechos suficientes desta página. Você ainda pode conferir os dados, as fontes e a data indicados nos cartões acima.</p>}
      <div className="review-limits"><h4>O que esta leitura não confirma</h4><ul>{result.unknowns.map(item => <li key={item}><span className="unknown-dash">—</span>{item}</li>)}</ul></div>
    </div>
    <div className="questions article-checklist">
      <div className="reflection-top"><span className="reflection-symbol"><Waypoints size={17} /></span><span>05 / SUA CONFERÊNCIA</span></div>
      <h3>Checklist da notícia<span>.</span></h3>
      <p>Marque cada item depois de conferir. As perguntas consideram o título, os trechos e os dados encontrados nesta matéria.</p>
      <div className="checklist-progress" aria-live="polite"><div><span>{checkedCount} de {result.checklist.length} conferidos</span><span>{Math.round(progress)}%</span></div><div className="checklist-track"><span style={{ width: `${progress}%` }} /></div></div>
      <ol className="checklist-list">{result.checklist.map((item, index) => <li key={item.id}><label><input type="checkbox" checked={Boolean(checked[item.id])} onChange={event => setChecked(current => ({ ...current, [item.id]: event.target.checked }))} /><span className="checklist-box"><Check size={13} /></span><span className="checklist-copy"><span className="checklist-index">{String(index + 1).padStart(2, '0')}</span>{item.text}</span></label></li>)}</ol>
      <p className="checklist-note">A lista ajuda a registrar o que você conferiu. Ela não classifica a notícia como verdadeira ou falsa.</p>
    </div>
  </section>
}
function Footer() { return <footer className="footer" id="sobre"><a href="#home" className="brand footer-brand"><span className="brand-mark"><span /><span /><span /><span /><span /></span><span>C1NC0</span></a><p>Ferramenta de apoio à avaliação<br />da confiabilidade da informação.</p><div className="footer-right"><span>TECNOLOGIA A SERVIÇO<br />DO PENSAMENTO CRÍTICO.</span><span className="footer-copy">© C1NC0 · 2025</span></div></footer> }

export default function App() { const [phase, setPhase] = useState<'idle' | 'loading' | 'success' | 'error'>('idle'); const [stage, setStage] = useState(0); const [result, setResult] = useState<NewsAnalysis | null>(null); const [error, setError] = useState(''); const [analyzerKey, setAnalyzerKey] = useState(0); const busy = phase === 'loading'; const analyzedAt = formatDateParts(new Date().toISOString());
  useEffect(() => { let frame = 0; const move = (event: MouseEvent) => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { document.documentElement.style.setProperty('--pointer-x', `${(event.clientX / window.innerWidth - .5) * 20}px`); document.documentElement.style.setProperty('--pointer-y', `${(event.clientY / window.innerHeight - .5) * 14}px`) }) }; const scroll = () => document.documentElement.style.setProperty('--scroll-y', `${window.scrollY * .08}px`); window.addEventListener('mousemove', move, { passive: true }); window.addEventListener('scroll', scroll, { passive: true }); return () => { cancelAnimationFrame(frame); window.removeEventListener('mousemove', move); window.removeEventListener('scroll', scroll) } }, [])
  const runAnalysis = async (url: string) => { setPhase('loading'); setResult(null); setStage(0); setError(''); let current = 0; const timer = window.setInterval(() => { current = Math.min(current + 1, 4); setStage(current) }, 420); try { const data = await analyzeNews(url); window.clearInterval(timer); setStage(5); setResult(data); setPhase('success'); window.setTimeout(() => document.getElementById('analysis-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100) } catch (reason) { window.clearInterval(timer); setError(reason instanceof Error ? reason.message : 'Não foi possível analisar essa página. Tente novamente.'); setPhase('error') } }
  // Errors stay visible until the reader starts another attempt.
  return <div className="app-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="page-grid" /><Header /><main><Hero /><div className="content-wrap"><URLAnalyzer key={analyzerKey} onAnalyze={runAnalysis} busy={busy} />{phase === 'error' && <div className="global-error" role="alert"><X size={16} />{error}</div>}<AnimatePresence mode="wait">{busy && <motion.div key="loading" initial={{ opacity: 0, height: 0 }} animate={{ height: 'auto' }} exit={{ opacity: 0 }}><AnalysisLoading current={stage} /></motion.div>}{phase === 'success' && result && <motion.div key="results" id="analysis-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .5 }}><EvidenceOverview result={result} /><NaiveBayesOverview result={result} /><ReflectionSections result={result} /><div className="result-footer"><Sparkles size={14} /><span>ANÁLISE CONCLUÍDA</span><span className="analysis-timestamp"><CalendarDays size={12} />{analyzedAt.date}<i /> <Clock3 size={12} />{analyzedAt.time}</span><button onClick={() => { setPhase('idle'); setResult(null); setAnalyzerKey(key => key + 1); document.getElementById('analisador')?.scrollIntoView({ behavior: 'smooth' }) }}>ANALISAR OUTRA URL <ArrowRight size={13} /></button></div></motion.div>}</AnimatePresence>{phase === 'idle' && <div className="method-preview"><span className="method-label">NOSSA ABORDAGEM</span><p>Informação não é um binário. É um convite à investigação.</p><span className="method-steps"><i>OBSERVAR</i><ArrowRight size={12} /><i>CONTEXTUALIZAR</i><ArrowRight size={12} /><i>QUESTIONAR</i></span><TransparencyNotice compact /></div>}</div></main><Footer /><FeedbackWidget /></div>
}
