import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
const stages = ['Conferindo o endereço', 'Lendo a página', 'Observando o título', 'Reunindo data e referências', 'Organizando os resultados']
export default function AnalysisLoading({ current }: { current: number }) {
  return <div className="loading-panel" aria-live="polite"><div><span className="eyebrow">ANÁLISE EM ANDAMENTO</span><h3>Observando a página<span className="ellipsis">...</span></h3><p>Estamos organizando os elementos disponíveis para esta URL.</p><div className="stage-list">{stages.map((stage, i) => <motion.div key={stage} className={`stage ${i < current ? 'done' : i === current ? 'current' : ''}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: i <= current ? 1 : .38, x: 0 }} transition={{ delay: i * .08 }}><span className="stage-icon">{i < current ? <Check size={13} /> : <i />}</span>{stage}{i === current && <span className="stage-live">em curso</span>}</motion.div>)}</div></div></div>
}
