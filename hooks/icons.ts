// Line symbols per skill type, drawn in a 48 unit box. The part marked `m` is what moves on hover.
const PATHS: Record<string, string> = {
  explore: '<circle cx="24" cy="24" r="10"/><path class="m" d="M28 20l-2.5 6.5L19 29l2.5-6.5z"/>',
  build: '<rect x="15" y="25" width="8" height="8" rx="1.5"/><rect x="25" y="25" width="8" height="8" rx="1.5"/><rect class="m" x="20" y="15" width="8" height="8" rx="1.5"/>',
  review: '<g class="m"><circle cx="22" cy="22" r="7.5"/><path d="M27.5 27.5L33 33"/><path d="M18.8 22.2l2.2 2.2 4.2-4.4"/></g>',
  write: '<g class="m"><path d="M16 32l2-6 11-11 4 4-11 11z"/><path d="M26 18l4 4"/></g>',
  other: '<g class="m"><rect x="16" y="16" width="6" height="6" rx="1.5"/><rect x="26" y="16" width="6" height="6" rx="1.5"/><rect x="16" y="26" width="6" height="6" rx="1.5"/><rect x="26" y="26" width="6" height="6" rx="1.5"/></g>',
}

// What each symbol does under the pointer: the needle swings, the top block lifts, the lens tilts,
// the pencil writes a stroke, the grid opens a little.
const MOVES: Record<string, string> = {
  explore: 'rotate(40deg)',
  build: 'translateY(-3px)',
  review: 'rotate(-12deg)',
  write: 'translate(-2px,2px) rotate(-6deg)',
  other: 'scale(1.12)',
}

// One Claude clay accent for every type: the symbol says the type, the colour says Claude.
// The stroke passes 3:1 on its 14% tile, on light (#B5522F) and dark (#E38C6A).
const TOKENS = `svg{--clay:#B5522F}@media (prefers-color-scheme:dark){svg{--clay:#E38C6A}}`
const EASE = 'cubic-bezier(.2,.7,.2,1)'
const STILL = '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}'

// The symbol on a soft clay tile, sized by the caller. Drawn interactive, so its part moves on hover.
export function kindIcon(kind: string) {
  const k = PATHS[kind] ? kind : 'other'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<style>${TOKENS}.t{fill:var(--clay);opacity:.14}.i{fill:none;stroke:var(--clay);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}` +
    `.m{transition:transform .25s ${EASE};transform-box:fill-box;transform-origin:center}svg:hover .m{transform:${MOVES[k]}}${STILL}</style>` +
    `<rect class="t" width="48" height="48" rx="12"/><g class="i">${PATHS[k]}</g></svg>`
}

// Claude's spark beside "Skills": `open` turns a quarter in as the library opens, `working` breathes while
// Claude works on a turn, `still` rests. Reduced motion keeps it still.
export function sparkIcon(state: 'open' | 'working' | 'still') {
  const rays = [0, 45, 90, 135].map(a => `<path d="M12 3.5v17" transform="rotate(${a} 12 12)"/>`).join('')
  const motion = state === 'open'
    ? `g{animation:in .32s ${EASE} both}@keyframes in{from{transform:rotate(-90deg) scale(.6);opacity:0}}`
    : state === 'working'
      ? 'g{animation:breathe 1.6s ease-in-out infinite alternate}@keyframes breathe{from{transform:scale(.78);opacity:.55}}'
      : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<style>${TOKENS}g{fill:none;stroke:var(--clay);stroke-width:2.6;stroke-linecap:round;transform-origin:12px 12px}${motion}${STILL}</style>` +
    `<g>${rays}</g></svg>`
}
