import { expect, mock, test } from 'claude-code/testing'
import type { Mounted, TestBody } from 'claude-code/testing'

const SKILLS: Record<string, string> = {
  declutter: 'Audit and simplify UI screens so they are clean and minimal.',
  write: 'Write or rewrite text in your voice. Works on prototype projects too.',
  directions: 'Explore several design directions on the same content.',
  prototype: 'Build a multi-page, clickable HTML prototype.',
  chime: 'Plays a sound.',
}
const PLUGIN: Record<string, string> = { 'figma-use': 'Build designs in Figma.', 'figma-diagram': 'Generate a diagram in FigJam.' }
const C = '/home/u/.claude/plugins/cache'
const DIRS: Record<string, string[]> = {
  '/home/u/.claude/skills': Object.keys(SKILLS),
  [C]: ['market'],
  [`${C}/market`]: ['figma', 'devtools'],
  [`${C}/market/figma`]: ['1.0.0'],
  [`${C}/market/figma/1.0.0/skills`]: Object.keys(PLUGIN),
  [`${C}/market/devtools`]: ['2.0.0'],
  [`${C}/market/devtools/2.0.0/skills`]: ['trace', 'trace-cpu', 'trace-memory', 'trace-network'],
}

type T = Parameters<TestBody>
async function setup($: T[0], on: T[1]) {
  mock.env(on, { HOME: '/home/u' })
  mock.store(on)
  mock.clock(on)
  on('fs.list', async ($, e) => ({
    value: (DIRS[e.path] ?? []).map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })),
  }))
  on('fs.read', async ($, e) => {
    const name = e.path.split('/').at(-2) ?? ''
    return { value: `---\nname: ${name}\ndescription: ${SKILLS[name] ?? PLUGIN[name] ?? 'Records a performance trace.'}\n---\n` }
  })
  const filled = { text: '' }
  on('prompt.read', async () => ({ value: { text: 'the home page', cursor: 13 } }))
  on('prompt.fill', async ($, e) => { filled.text = e.text; return { isFilled: true } })

  await $.command.run({ command: 'skill-library', args: '' } as Parameters<typeof $.command.run>[0])
  return filled
}

const reopen = ($: T[0]) => $.command.run({ command: 'skill-library', args: '' } as Parameters<typeof $.command.run>[0])

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 100, scroll: { offset: 0, bodyRows: 40 }, view: {} } } as const

test('the band defaults to my skills, switches source, filters and drops a skill into the prompt on every surface', async ($, on) => {
  const filled = await setup($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    expect(await ui.find({ key: 'use-declutter' })).toBeDefined()
    expect(await ui.find({ key: 'use-figma:figma-use' })).toBeUndefined()
    await ui.select({ key: 'from', value: 'figma' })
    expect(await ui.find({ key: 'use-figma:figma-use' })).toBeDefined()
    expect(await ui.find({ key: 'use-declutter' })).toBeUndefined()
    await ui.select({ key: 'from', value: 'mine' })
    await ui.press({ key: 'kind-write' })
    expect(await ui.find({ key: 'use-declutter' })).toBeUndefined()
    await ui.press({ key: 'kind-all' })
    // Use fills the prompt and closes the band; the command opens it again.
    await ui.press({ key: 'use-write' })
    expect(filled.text).toBe('/write the home page')
    await ui.unmount()
    await reopen($)
  }
})

test('a short band still reaches every row, and Load more adds the rest', async ($, on) => {
  await setup($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const short = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND, props: { ...BAND.props, maxRows: 14 } })
    expect(await short.find({ key: 'kind-all' })).toBeDefined()
    // The terminal windows the list under the tabs; desktop draws every row and scrolls the band itself.
    if (surface === 'terminal') expect(await short.find({ type: 'Text', text: /Scroll for 3 more/ })).toBeDefined()
    else expect(await short.find({ key: 'use-chime' })).toBeDefined()
    await short.unmount()
    const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND, props: { ...BAND.props, maxRows: 80 } })
    await ui.select({ key: 'from', value: 'all' })
    expect(await ui.find({ type: 'Text', text: /8 of 11/ })).toBeDefined()
    await ui.press({ key: 'more' })
    expect(await ui.find({ key: 'more' })).toBeUndefined()
    await ui.select({ key: 'from', value: 'mine' })
    await ui.unmount()
  }
})

test('edit renames, retypes and hides a skill with one Save, and Hidden brings it back', async ($, on) => {
  await setup($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    expect((await ui.find({ key: 'edit-declutter' }))?.text).toBe(surface === 'desktop' ? '✎' : 'Edit')

    // Typing alone saves nothing; Save keeps the name and moves the skill to the type picked.
    await ui.press({ key: 'edit-declutter' })
    await ui.input({ key: 'title-declutter', text: 'Tidy', kind: 'change' })
    await ui.select({ key: 'kind-of-declutter', value: 'write' })
    await ui.press({ key: 'cancel-declutter' })
    expect(await ui.find({ type: 'Text', text: 'Tidy' })).toBeUndefined()
    await ui.press({ key: 'edit-declutter' })
    await ui.input({ key: 'title-declutter', text: 'Tidy', kind: 'change' })
    await ui.select({ key: 'kind-of-declutter', value: 'write' })
    await ui.press({ key: 'save-declutter' })
    expect(await ui.find({ type: 'Text', text: 'Tidy' })).toBeDefined()
    await ui.press({ key: 'kind-write' })
    expect(await ui.find({ key: 'use-declutter' })).toBeDefined()
    await ui.press({ key: 'kind-all' })

    // Hide takes it out of Mine; Hidden lists it, and Unhide brings it back.
    await ui.press({ key: 'edit-declutter' })
    await ui.press({ key: 'hide-declutter' })
    expect(await ui.find({ key: 'use-declutter' })).toBeUndefined()
    await ui.select({ key: 'from', value: 'hidden' })
    await ui.press({ key: 'edit-declutter' })
    await ui.press({ key: 'hide-declutter' })
    await ui.select({ key: 'from', value: 'mine' })
    expect(await ui.find({ key: 'use-declutter' })).toBeDefined()

    // Reset drops the name and type again.
    await ui.press({ key: 'edit-declutter' })
    await ui.press({ key: 'reset-declutter' })
    expect(await ui.find({ type: 'Text', text: 'Tidy' })).toBeUndefined()
    await ui.unmount()
  }
})

test('plugin skills drop their prefix in the title, and Use still types the full command', async ($, on) => {
  const filled = await setup($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    await ui.select({ key: 'from', value: 'figma' })
    expect(await ui.find({ type: 'Text', text: '/figma-use' })).toBeDefined()
    await ui.press({ key: 'use-figma:figma-use' })
    expect(filled.text).toBe('/figma:figma-use the home page')
    await ui.unmount()
    await reopen($)
    const again = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    await again.select({ key: 'from', value: 'mine' })
    await again.unmount()
  }
})

test('search filters every source as you type, and a pick clears it', async ($, on) => {
  const filled = await setup($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    await ui.input({ key: 'search', text: 'figjam', kind: 'change' })
    expect(await ui.find({ key: 'use-figma:figma-diagram' })).toBeDefined()
    expect(await ui.find({ key: 'use-declutter' })).toBeUndefined()
    await ui.input({ key: 'search', text: 'zzz', kind: 'change' })
    expect(await ui.find({ type: 'Text', text: /No skills match/ })).toBeDefined()
    await ui.input({ key: 'search', text: 'figjam', kind: 'change' })
    expect(await ui.find({ key: 'use-figma:figma-diagram' })).toBeDefined()
    // Use closes the band and clears the search for next time.
    await ui.press({ key: 'use-figma:figma-diagram' })
    expect(filled.text).toBe('/figma:figma-diagram the home page')
    await ui.unmount()
    await reopen($)
  }
})

test('with no skills the band says how to add one instead of staying empty', async ($, on) => {
  mock.env(on, { HOME: '/nobody' })
  mock.store(on)
  mock.clock(on)
  on('fs.list', async () => ({ value: [] }))
  await reopen($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /No skills yet/ })).toBeDefined()
    expect(await ui.find({ key: 'close' })).toBeDefined()
    await ui.unmount()
  }
})

test('the side panel draws the same library and keeps itself open after Use', async ($, on) => {
  const filled = await setup($, on)
  const PANE = { component: 'Pane', requestId: 'skill-library', props: { title: 'Skills', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 } } } as const
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = (await $.ui.mount({ plugin: 'skill-library', surface, ...PANE } as Parameters<typeof $.ui.mount>[0])) as unknown as Mounted<'desktop', 'Pane'>
    expect(await ui.find({ key: 'collapse' })).toBeDefined()
    // The panel shows the whole library at once: no Load more for a normal number of skills.
    await ui.select({ key: 'from', value: 'all' })
    expect(await ui.find({ key: 'use-devtools:trace-network' })).toBeDefined()
    expect(await ui.find({ key: 'more' })).toBeUndefined()
    await ui.select({ key: 'from', value: 'mine' })
    await ui.press({ key: 'use-declutter' })
    expect(filled.text).toBe('/declutter the home page')
    expect(await ui.find({ key: 'use-declutter' })).toBeDefined()
    await ui.unmount()
  }
})

test('a search puts the skill whose name matches above ones that only mention it', async ($, on) => {
  await setup($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    expect(await ui.find({ key: 'clear' })).toBeUndefined()
    await ui.input({ key: 'search', text: 'prototype', kind: 'change' })
    const uses = (await ui.findAll({ type: 'Button', text: 'Use' })).map(b => b.key)
    expect(uses).toEqual(['use-prototype', 'use-write'])
    // The × shows only while there is text; it clears the search and brings every skill back.
    await ui.press({ key: 'clear' })
    expect(await ui.find({ key: 'use-declutter' })).toBeDefined()
    expect(await ui.find({ key: 'clear' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the skills you pick most come first under Most used, and the terminal numbers its rows', async ($, on) => {
  const filled = await setup($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    // Pick chime twice and write once: chime leads Most used, write follows.
    for (const name of ['chime', 'write', 'chime']) {
      const ui = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
      await ui.press({ key: `use-${name}` })
      await ui.unmount()
      await reopen($)
    }
    const again = await $.ui.mount({ plugin: 'skill-library', surface, ...BAND })
    expect(await again.find({ type: 'Text', text: 'Most used' })).toBeDefined()
    const order = (await again.findAll({ type: 'Button', text: /Use/ })).map(b => b.key)
    expect(order.slice(0, 2)).toEqual(['use-chime', 'use-write'])
    // Number keys on the terminal only; desktop shows no number that could read as a rank.
    expect((await again.find({ key: 'use-chime' }))?.props.hotkey).toBe(surface === 'terminal' ? '1' : undefined)
    await again.press({ key: 'use-declutter' })
    expect(filled.text).toBe('/declutter the home page')
    await again.unmount()
    await reopen($)
  }
})
