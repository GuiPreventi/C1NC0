import { Info } from 'lucide-react'
export default function TransparencyNotice({ compact = false }: { compact?: boolean }) { return <div className={`transparency ${compact ? 'compact' : ''}`}><span className="notice-icon"><Info size={16} /></span><p>A ferramenta não determina se uma notícia é verdadeira ou falsa. Ela apresenta evidências e indícios para apoiar sua avaliação.</p></div> }
