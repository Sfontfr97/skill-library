
export const describe = (text: string) => {
  const m = text.match(/^---[\s\S]*?\ndescription:\s*(.+)\n/)
  const d = (m?.[1] ?? '').replace(/^["']|["']$/g, '').trim()
  return d
}


// The first sentence, without the "Use when..." trigger list most skills carry.
export const firstSentence = (d: string) => (d.match(/^.*?[.!?](\s|$)/)?.[0] ?? d).trim()

// Works for any skill set: the type comes from the skill's name, then its own description.
export const KINDS: { id: string; label: string; words: RegExp }[] = [
  { id: 'review', label: 'Review', words: /(review|audit|\bqa\b|evaluat|debug|troubleshoot|retrospective|accessib|a11y|declutter|optimi[sz])/i },
  { id: 'write', label: 'Write', words: /(\bwrite|rewrite|\bcopy\b|message|email|document|report|summar|handoff|\bspec)/i },
  { id: 'explore', label: 'Explore', words: /(explore|research|options|direction|brainstorm|compare|ideas)/i },
  { id: 'build', label: 'Build', words: /(build|create|generat|implement|prototype|component|translat|diagram|library)/i },
]
const clean = (t: string) => t.replace(/\*\*|`/g, '')
export const kindOf = (text: string, name = '') => {
  const tries = [name.replace(/-/g, ' '), firstSentence(summary(text)), clean(text)]
  for (const t of tries) { const k = KINDS.find(k => k.words.test(t)); if (k) return k.id }
  return 'other'
}
export const kindLabel = (id: string) => KINDS.find(k => k.id === id)?.label ?? 'Other'

// One readable line: skips "Use this skill when..." and "MANDATORY" openers, stops at a colon or dash, caps the length.
const SKIP = /^(use (this skill )?(when|whenever|alongside|for)|use this skill|trigger|do not|never|read this|mandatory|also trigger|skipping|this is the preferred|usage)/i
export const summary = (d: string) => {
  const sentences = clean(d).split(/(?<=[.!?])\s+/)
  let line = sentences.find(x => !SKIP.test(x.trim()) && x.trim().length >= 25) ?? sentences[0] ?? ''
  line = line.replace(/^use this skill (whenever|when) /i, 'For when ').split(/\s[—–-]\s|:\s|\s↔/)[0]?.trim() ?? ''
  if (line.length > 110) line = line.slice(0, 107).replace(/[\s,]+\S*$/, '') + '…'
  return line
}
