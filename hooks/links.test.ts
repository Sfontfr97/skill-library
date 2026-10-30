import { expect, test } from 'claude-code/testing'
import { describe, firstSentence, kindOf, summary } from './links'
import { kindIcon, sparkIcon } from './icons'

test('reads the description', () => {
  expect(describe('---\nname: x\ndescription: Does a thing\n---\nbody')).toBe('Does a thing')
  expect(firstSentence('Audit screens. Use when asked.')).toBe('Audit screens.')
})

test('guesses the type from any description', () => {
  expect(kindOf('Audit and simplify UI screens so they are clean.')).toBe('review')
  expect(kindOf('Build a multi-page, clickable HTML prototype.')).toBe('build')
  expect(kindOf('Write or rewrite text in your voice.')).toBe('write')
  expect(kindOf('Plays a sound.')).toBe('other')
})

test('summary skips trigger lists and stops at a colon', () => {
  expect(summary('Use this skill whenever X. Makes reports: long list.')).toBe('Makes reports')
})

test('every type gets a clay symbol, unknown types fall back to other', () => {
  for (const k of ['review', 'write', 'explore', 'build', 'other', 'nope']) {
    const svg = kindIcon(k)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.includes('--clay')).toBe(true)
  }
  expect(kindIcon('nope')).toBe(kindIcon('other'))
})

test('the spark turns in on open, breathes while Claude works, rests otherwise, and honours reduced motion', () => {
  expect(sparkIcon('open').includes('@keyframes in')).toBe(true)
  expect(sparkIcon('working').includes('infinite')).toBe(true)
  expect(sparkIcon('still').includes('@keyframes')).toBe(false)
  for (const state of ['open', 'working', 'still'] as const) expect(sparkIcon(state).includes('prefers-reduced-motion')).toBe(true)
  expect(kindIcon('write').includes('svg:hover .m')).toBe(true)
})
