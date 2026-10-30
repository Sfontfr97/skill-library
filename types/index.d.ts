export type Skill = { name: string; source: string; description: string }
// What someone changed about a skill in Edit: its name, description, type, and whether it is hidden.
export type Label = { title?: string; line?: string; kind?: string; hidden?: boolean }
// Times a skill was picked, and when last (ms).
export type Use = { n: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'skill-library': { skills: Skill[]; open: string; from: string; isBand: boolean; offset: number; loaded: number; query: string; uses: Record<string, Use>; openedAt: number; labels: Record<string, Label>; editing: string; draft: Label }
  }
}
