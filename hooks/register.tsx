import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderSurface } from 'claude-code'
import { kindIcon, sparkIcon } from './icons'
import { describe, KINDS, kindLabel, kindOf, summary } from './links'

import type { Label, Skill, Use } from '../types'

const skills = atom({ plugin: 'skill-library', key: 'skills' } as const, [])
const open = atom({ plugin: 'skill-library', key: 'open' } as const, '')
// Where the skills come from: 'mine', 'all', or one plugin's name. Empty until picked.
const origin = atom({ plugin: 'skill-library', key: 'from' } as const, '')
const labels = atom({ plugin: 'skill-library', key: 'labels' } as const, {} as Record<string, Label>)
const editing = atom({ plugin: 'skill-library', key: 'editing' } as const, '')
// What the open edit form holds until Save: name, description and type.
const draft = atom({ plugin: 'skill-library', key: 'draft' } as const, {} as Label)
const offset = atom({ plugin: 'skill-library', key: 'offset' } as const, 0)
const loaded = atom({ plugin: 'skill-library', key: 'loaded' } as const, 0)
const query = atom({ plugin: 'skill-library', key: 'query' } as const, '')
// How often and when each skill was picked, kept across sessions; the top of Mine shows the most used.
const uses = atom({ plugin: 'skill-library', key: 'uses' } as const, {} as Record<string, Use>)
const MOST_USED = 3
// When the library last opened, so the spark turns in once and then rests.
const openedAt = atom({ plugin: 'skill-library', key: 'openedAt' } as const, 0)
// The side panel Expand opens: the same library, as tall as the window.
const PANE = 'skill-library'
// Rows loaded at first and added by each Load more: a few in the band, most libraries whole in the panel.
// The panel stops at 40 so a big library stays inside the engine's limit on one drawing (100,000 characters).
const PAGE = 8
const PANE_PAGE = 40
// Rows the band keeps for the two header rows and the footer, each with its gap.
const CHROME = 6
// A plugin's folder name as a label: 'chrome-devtools-mcp' reads 'Chrome devtools mcp'.
const sentence = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]+/g, ' ')
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,]+\S*$/, '') + '…' : s)
// The last offset the list allows, as drawn last; the wheel stops there.
let lastMax = 0
const isBand = atom({ plugin: 'skill-library', key: 'isBand' } as const, false)

async function dirs($: EngineInterface, path: string) {
  const entries = await $.fs.list(path).catch(() => [])
  return entries.filter(one => one.kind !== 'file').map(one => one.name).sort()
}

async function readSkills($: EngineInterface, root: string, prefix: string, source: string) {
  const out: Skill[] = []
  for (const name of await dirs($, root)) {
    const text = await $.fs.read(`${root}/${name}/SKILL.md`).catch(() => '')
    if (text) out.push({ name: prefix + name, source, description: describe(text) })
  }
  return out
}

// Your own skills, then the latest version of each installed plugin's skills.
async function scan($: EngineInterface) {
  const home = `${(await $.env.get('HOME')) ?? ''}/.claude`
  const list = await readSkills($, `${home}/skills`, '', 'mine')
  const cache = `${home}/plugins/cache`
  for (const market of await dirs($, cache)) {
    for (const plugin of await dirs($, `${cache}/${market}`)) {
      const versions = await dirs($, `${cache}/${market}/${plugin}`)
      const latest = versions[versions.length - 1]
      if (latest) list.push(...(await readSkills($, `${cache}/${market}/${plugin}/${latest}/skills`, `${plugin}:`, plugin)))
    }
  }
  const saved = ((await $.store.get('labels')) ?? {}) as Record<string, Label>
  await update($, labels, () => saved)
  const counted = ((await $.store.get('uses')) ?? {}) as Record<string, Use>
  await update($, uses, () => counted)
  await update($, skills, () => list.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name)))
}

// The library, drawn in the band above the prompt or in the side panel. `maxRows` is the band's room on
// the terminal, where the list is windowed under the tab row; null where the surface scrolls by itself.
async function draw($: EngineInterface, ui: Elements[RenderSurface], surface: RenderSurface, maxRows: number | null, isPane: boolean, isWorking: boolean) {
  const { Box, Text, Button } = ui
  const Input = 'Input' in ui ? ui.Input : null
  const all = await read($, skills)
  const names = await read($, labels)
  const edit = await read($, editing)
  const form = await read($, draft)
  // Saves a display name, description, type or hidden flag; null clears them all. Kept across sessions.
  const relabel = async (name: string, patch: Label | null) => {
    const kept = { ...names }
    if (patch === null) delete kept[name]
    else kept[name] = { ...kept[name], ...patch }
    await $.store.set('labels', kept)
    await update($, labels, () => kept)
  }
  const startEdit = async (name: string) => {
    const own = names[name] ?? {}
    await update($, draft, () => ({ title: own.title, line: own.line, kind: own.kind }))
    await update($, editing, () => name)
  }
  // Empty fields mean "use the skill's own"; the hidden flag stays as it was.
  const save = async (name: string) => {
    const d = await read($, draft)
    await relabel(name, { title: d.title?.trim() || undefined, line: d.line?.trim() || undefined, kind: d.kind })
    await update($, editing, () => '')
  }
  const reset = async (name: string) => {
    await relabel(name, names[name]?.hidden ? { title: undefined, line: undefined, kind: undefined } : null)
    await update($, editing, () => '')
  }
  const hide = async (name: string, isOn: boolean) => {
    await relabel(name, { hidden: isOn || undefined })
    await update($, editing, () => '')
    $.ui.toast(isOn ? 'Hidden. Find it under Show, Hidden.' : 'Back in the list.')
  }
  const closeBand = () => void update($, isBand, () => false)
  const expand = async () => {
    const opened = await $.ui.open({ id: PANE, title: 'Skills' })
    if (opened.isPlaced) closeBand()
    else $.ui.toast('The panel needs a wider window.')
  }
  // Close in the band, Collapse in the panel (back to the band), and Expand in the band where panels exist.
  const ends = (
    <Box flexDirection="row" alignItems="center" gap={2} flexShrink={0}>
      {isPane
        ? <Button key="collapse" plain dimColor onPress={() => { void update($, isBand, () => true); void $.ui.close({ id: PANE }) }}>Collapse</Button>
        : <Button key="expand" plain dimColor onPress={() => void expand()}>Expand</Button>}
      {!isPane && <Button key="close" role="dismiss" plain dimColor onPress={closeBand}>Close</Button>}
    </Box>
  )
  // The spark is the band's one moving part (desktop): it turns in as the library opens and breathes while
  // Claude works on a turn, so the motion says something. The terminal keeps the ✻ glyph.
  const age = (await $.clock.now()) - (await read($, openedAt))
  const spark = isWorking ? 'working' : age < 900 ? 'open' : 'still'
  const brand = 'Svg' in ui
    ? (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <ui.Svg source={sparkIcon(spark)} width={16} height={16} isInteractive alt={isWorking ? 'Claude is working' : 'Claude'} />
        <Text bold>Skills</Text>
      </Box>
    )
    : <Text><Text color="claude">✻</Text> <Text bold>Skills</Text></Text>
  if (all.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">{isPane ? <Text> </Text> : brand}{ends}</Box>
        <Text dimColor>No skills yet. Add a folder with a SKILL.md to ~/.claude/skills, then open this again.</Text>
      </Box>
    )
  }
  const typed = await read($, query)
  const q = typed.trim().toLowerCase()
  // How well a skill answers the search: its name first, then what the row shows, then the full description
  // (which often names other skills, as in "works on curated-prototype projects"). 0 is no match.
  const score = (s: Skill) => {
    const own = names[s.name] ?? {}
    const name = s.name.replace(/^[^:]+:/, '').toLowerCase()
    if (name.startsWith(q)) return 5
    if (name.includes(q) || (own.title ?? '').toLowerCase().includes(q)) return 4
    if ([own.line ?? '', summary(s.description)].some(t => t.toLowerCase().includes(q))) return 3
    if (s.name.toLowerCase().includes(q)) return 2
    return s.description.toLowerCase().includes(q) ? 1 : 0
  }
  const matches = (s: Skill) => score(s) > 0
  // A type someone picked in Edit wins over the guess from the name and description.
  const guessOf = (s: Skill) => kindOf(s.description, s.name)
  const kindOfSkill = (s: Skill) => names[s.name]?.kind ?? guessOf(s)
  // Hidden skills leave every source and the search; they wait under Hidden, last in Show, to come back.
  const isHidden = (s: Skill) => names[s.name]?.hidden === true
  const visible = all.filter(s => !isHidden(s))
  const hiddenCount = all.length - visible.length
  // Sources: Mine, All, then each plugin, the biggest first, then Hidden. Mine is the default when there is any.
  const sizeOf = (src: string) => visible.filter(s => s.source === src).length
  const plugins = [...new Set(visible.map(s => s.source))].filter(src => src !== 'mine')
    .sort((a, b) => sizeOf(b) - sizeOf(a) || a.localeCompare(b))
  const sources = [...(sizeOf('mine') ? ['mine'] : []), 'all', ...plugins, ...(hiddenCount ? ['hidden'] : [])]
  const picked = await read($, origin)
  // A search looks through every source, so Show reads Everything while it runs.
  const src = q ? 'all' : sources.includes(picked) ? picked : sources[0]!
  const pool = src === 'hidden' ? all.filter(isHidden) : src === 'all' ? visible : visible.filter(s => s.source === src)
  const shown = pool.filter(s => !q || matches(s))
  const sourceLabel = (id: string) => id === 'mine' ? 'Mine' : id === 'all' ? 'Everything' : id === 'hidden' ? 'Hidden' : sentence(id)
  const kinds = [...KINDS.map(k => k.id), 'other'].filter(id => shown.some(s => kindOfSkill(s) === id))
  const saved = await read($, open)
  const kind = kinds.includes(saved) ? saved : ''
  const rank = (s: Skill) => kinds.indexOf(kindOfSkill(s))
  // Browsing groups the list by type; a search lists the best matches first, with no type headers.
  const isGrouped = kind === '' && !q
  // Browsing your own skills, the ones you pick most come first under Most used, and leave their type group.
  const tally = await read($, uses)
  const mostUsed = isGrouped && src === 'mine'
    ? shown.filter(s => tally[s.name]).map(s => s.name)
      .sort((a, b) => tally[b]!.n - tally[a]!.n || tally[b]!.at - tally[a]!.at).slice(0, MOST_USED)
    : []
  const groupOf = (s: Skill) => (mostUsed.includes(s.name) ? 'most' : kindOfSkill(s))
  const groupRank = (s: Skill) => (mostUsed.includes(s.name) ? -1 : rank(s))
  const list = (kind === '' ? shown : shown.filter(s => kindOfSkill(s) === kind))
    .slice().sort((a, b) => (q ? score(b) - score(a) : 0) || groupRank(a) - groupRank(b)
      || mostUsed.indexOf(a.name) - mostUsed.indexOf(b.name) || a.name.localeCompare(b.name))
  const countOf = (id: string) => shown.filter(s => kindOfSkill(s) === id).length
  // On the terminal the tab row stays put: the list is sized to the band and the wheel scrolls it here.
  // Native surfaces scroll the band themselves and never tell the mod, so there every loaded row is drawn.
  const isNative = surface !== 'terminal'
  const page = isPane ? PANE_PAGE : PAGE
  const count = Math.min(list.length, Math.max(page, await read($, loaded)))
  const budget = Math.max(3, (maxRows ?? 0) - CHROME)
  const isWindowed = maxRows !== null && !isNative
  // How many loaded rows fit from `start`: two lines a row, a gap between rows, a type header before a new type.
  const fitFrom = (start: number) => {
    let used = 0
    let n = 0
    for (let i = start; i < count; i++) {
      const s = list[i]!
      const hasHeader = isGrouped && (n === 0 || groupOf(list[i - 1]!) !== groupOf(s))
      const h = (n > 0 ? 1 : 0) + (edit === s.name ? 9 : 2) + (hasHeader ? (n > 0 ? 2 : 1) : 0)
      if (n > 0 && used + h > budget) break
      used += h
      n++
    }
    return n
  }
  let max = 0
  if (isWindowed) while (max < count - 1 && max + fitFrom(max) < count) max++
  lastMax = max
  const from = Math.min(Math.max(0, await read($, offset)), max)
  const rows = isWindowed ? list.slice(from, from + fitFrom(from)) : list.slice(0, count)
  const below = list.length - from - rows.length
  // Loads the next rows and scrolls so the last row seen stays on top.
  const loadMore = () => {
    void update($, loaded, () => count + page)
    if (isWindowed) void update($, offset, () => from + rows.length - 1)
  }
  const restart = () => { void update($, offset, () => 0); void update($, loaded, () => PAGE) }
  const pick = (id: string) => () => { void update($, open, () => id); restart() }
  // Puts the command in front of whatever is typed, replacing a command already there. The band then
  // closes, since the pick is in the prompt; the panel stays, it covers nothing.
  const use = (name: string) => async () => {
    const { text } = await $.prompt.read()
    const rest = text.replace(/^\/\S+\s*/, '')
    await $.prompt.fill({ text: `/${name} ${rest}` })
    const at = await $.clock.now()
    const was = await read($, uses)
    const counted = { ...was, [name]: { n: (was[name]?.n ?? 0) + 1, at } }
    await $.store.set('uses', counted)
    await update($, uses, () => counted)
    if (!isPane) { closeBand(); void update($, query, () => '') }
  }
  const search = (v: string) => { void update($, query, () => v); restart() }
  // A filter is its label with a dim count, both inside the button so the count sits in the chip.
  // The terminal marks the active one in clay and bold; native surfaces ignore text colour inside a
  // button, so there the active one is a bordered chip, like the Show picker, and the rest are dim.
  const tab = (id: string, label: string, n: number) => {
    const isActive = kind === id
    const key = `kind-${id || 'all'}`
    const tally = <Text dimColor>  {n}</Text>
    if (isNative) {
      return isActive
        ? <Button key={key} variant="secondary" onPress={pick(id)}>{label}{tally}</Button>
        : <Button key={key} plain dimColor onPress={pick(id)}>{label}{tally}</Button>
    }
    return (
      <Button key={key} plain onPress={pick(id)}>
        <Text color={isActive ? 'claude' : undefined} bold={isActive} dimColor={!isActive}>{label}</Text>{tally}
      </Button>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      {/* Two rows: the tools (where from, search, the band's own buttons), then the type tabs on their own
          row, so a long set of tabs never pushes the tools around. */}
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={2}>
          <Box flexDirection="row" alignItems="center" columnGap={3} flexShrink={1}>
            {!isPane && brand}
            {sources.length > 2 && 'Select' in ui && (
              <ui.Select key="from" label="Show" value={src}
                options={sources.map(id => ({ value: id, label: sourceLabel(id) }))}
                onSelect={(v: string) => { void update($, origin, () => v); void update($, query, () => ''); restart() }} />
            )}
            {/* The list filters as you type, so the field gets no submit label: desktop then draws no button
                beside it, and Enter clears it. A × follows the field only while there is text; laying it over
                the field made desktop clip the field's edge. The magnifier leads the placeholder. */}
            {'Input' in ui && (
              <Box key="search-box" flexDirection="row" alignItems="center" gap={1} flexShrink={1}>
                <Box width={40} flexShrink={1}>
                  <ui.Input key="search" label={isNative ? undefined : 'Search'} value={typed}
                    placeholder={isNative ? '⌕  Search skills' : 'Search skills'} onInput={search} onSubmit={() => search('')} />
                </Box>
                {q && <Button key="clear" label={isNative ? '×' : 'Clear'} plain dimColor hover={{ color: 'claude' }} onPress={() => search('')} />}
              </Box>
            )}
          </Box>
          {ends}
        </Box>
        <Box flexDirection="row" columnGap={2} flexWrap="wrap">
          {tab('', 'All', shown.length)}
          {kinds.map(id => tab(id, kindLabel(id), countOf(id)))}
        </Box>
      </Box>
      {rows.length === 0 && <Text dimColor>No skills match “{q}”.</Text>}
      <Box flexDirection="column" gap={1}>
        {rows.map((s, i) => {
          const k = kindOfSkill(s)
          const group = groupOf(s)
          const isFirst = i === 0 || groupOf(rows[i - 1]!) !== group
          // On the terminal the first nine rows answer their number key, drawn as `1: Use`. Desktop draws no
          // hotkey on a button, and a dim number beside it read as a rank, so desktop has none.
          const hotkey = !isNative && i < 9 ? String(i + 1) : undefined
          const own = names[s.name] ?? {}
          // A plugin skill drops its `plugin:` prefix from the title; Show names the plugin, or the prefix follows dim.
          const bare = s.source === 'mine' ? s.name : s.name.replace(/^[^:]+:/, '')
          const title = own.title || `/${bare}`
          const aside = own.title ? `/${s.name}` : src === 'all' && s.source !== 'mine' ? sentence(s.source) : ''
          const line = own.line || clip(summary(s.description) || 'No description yet.', 140)
          const isEditing = edit === s.name
          return (
            <Box key={`row-${s.name}`} flexDirection="column">
              {isFirst && isGrouped && (
                <Box marginTop={i === 0 ? 0 : 1}><Text dimColor>{group === 'most' ? 'Most used' : kindLabel(k)}</Text></Box>
              )}
              <Box flexDirection="row" alignItems="center" gap={2}>
                {'Svg' in ui && <ui.Svg source={kindIcon(k)} width={32} height={32} isInteractive alt={`${kindLabel(k)} skill`} />}
                <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
                  {isEditing && Input ? (
                    // One form, one Save: the fields keep what is typed, Enter in either saves.
                    <Box flexDirection="column" gap={1}>
                      <Input key={`title-${s.name}`} label="Name" placeholder={`/${s.name}`} value={form.title ?? ''} autoFocus
                        onInput={v => void update($, draft, d => ({ ...d, title: v }))} onSubmit={() => void save(s.name)} />
                      <Input key={`line-${s.name}`} label="Description" placeholder={summary(s.description)} value={form.line ?? ''}
                        onInput={v => void update($, draft, d => ({ ...d, line: v }))} onSubmit={() => void save(s.name)} />
                      <Box flexDirection="row" alignItems="center" gap={3} flexWrap="wrap">
                        {'Select' in ui && (
                          <ui.Select key={`kind-of-${s.name}`} label="Type" value={form.kind ?? 'auto'}
                            options={[{ value: 'auto', label: `Automatic (${kindLabel(guessOf(s))})` },
                              ...[...KINDS.map(k => k.id), 'other'].map(id => ({ value: id, label: kindLabel(id) }))]}
                            onSelect={(v: string) => void update($, draft, d => ({ ...d, kind: v === 'auto' ? undefined : v }))} />
                        )}
                        <Button key={`hide-${s.name}`} plain dimColor onPress={() => void hide(s.name, !isHidden(s))}>
                          {isHidden(s) ? 'Unhide' : 'Hide'}
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Text wrap="truncate-end">
                        <Text bold hover={{ color: 'claude' }}>{title}</Text>
                        {aside ? <Text dimColor>  {aside}</Text> : ''}
                      </Text>
                      <Text dimColor wrap="truncate-end">{line}</Text>
                    </>
                  )}
                </Box>
                {/* Each pair sits straight in its row Box: the desktop stacks a fragment's children. */}
                {isEditing ? (
                  <Box flexDirection="row" alignItems="center" gap={2} flexShrink={0} flexWrap="nowrap">
                    {(own.title || own.line || own.kind) && <Button key={`reset-${s.name}`} plain dimColor onPress={() => void reset(s.name)}>Reset</Button>}
                    <Button key={`cancel-${s.name}`} plain dimColor onPress={() => void update($, editing, () => '')}>Cancel</Button>
                    <Button key={`save-${s.name}`} variant="primary" onPress={() => void save(s.name)}>Save</Button>
                  </Box>
                ) : (
                  <Box flexDirection="row" alignItems="center" gap={1} flexShrink={0} flexWrap="nowrap">
                    {/* A pencil on native surfaces; the word on the terminal, where fonts may lack the glyph.
                        Native surfaces draw a Button's label as its text, so the glyph is the label itself. */}
                    <Button key={`edit-${s.name}`} label={isNative ? '✎' : 'Edit'} plain dimColor
                      hover={{ color: 'claude' }} onPress={() => void startEdit(s.name)} />
                    <Button key={`use-${s.name}`} plain hotkey={hotkey} hover={{ color: 'claude', bold: true }} onPress={use(s.name)}>Use</Button>
                  </Box>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
      {from + rows.length < count ? (
        <Text dimColor>Scroll for {below} more</Text>
      ) : count < list.length && (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text dimColor>{count} of {list.length}</Text>
          <Button key="more" plain onPress={loadMore}>Load more</Button>
        </Box>
      )}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'skill-library', description: 'Browse your skills and use one, above the prompt' })
    return next(e)
  })

  on('command.run', { command: 'skill-library' }, async $ => {
    await scan($)
    const was = await read($, isBand)
    await update($, isBand, () => !was)
    await update($, query, () => '')
    if (!was) {
      const now = await $.clock.now()
      await update($, openedAt, () => now)
    }
    return { text: was ? 'Skill library closed.' : 'Skill library is above the prompt.' }
  })

  on('ui.scroll', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!(await read($, isBand)) || e.contentRows > e.bodyRows) return next(e)
    const step = Math.sign(e.by)
    if (step !== 0) await update($, offset, o => Math.min(Math.max(0, Math.min(o, lastMax) + step), lastMax))
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!(await read($, isBand)) || e.props.hasSurvey) return next(e)
    return draw($, $.ui.resolve(e), e.surface, e.props.maxRows, false, e.props.isWorking)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) =>
    draw($, $.ui.resolve(e), e.surface, null, true, false))
}
