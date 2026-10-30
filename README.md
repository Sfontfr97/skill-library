# Skill library

A Claude Code mod that lists your skills above the prompt, grouped by type, with a one line description each. Click Use to put `/skill-name` into the prompt, or Edit to rename a skill, rewrite its description, change its type or hide it (saved across sessions, the skill files stay untouched). Hidden skills wait under Show, Hidden.

Open or close it with `/skill-library`. Search filters every source as you type; × (or Enter) clears it. Use puts the skill in the prompt and closes the band. Expand opens the same library as a full-height side panel, which stays open while you work; Collapse puts it back above the prompt.

> Skill library is an independent, personal project. It is not made, endorsed or supported by Anthropic. Claude and Claude Code are trademarks of Anthropic, used here only to say what this mod works with.

## Install

1. Get the folder: click **Code → Download ZIP** on this page and unzip it, or run `git clone https://github.com/Sfontfr97/skill-library.git`. Move it somewhere it can stay, for example `~/Tools/skill-library`. If it unzipped as `skill-library-main`, rename it to `skill-library`.
2. Desktop app: add the folder's path to `~/.claude/settings.json`, then quit and reopen the app:

   ```json
   "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/Users/your-name/Tools/skill-library" }
   ```

   Terminal: start Claude with `claude --plugin-dir ~/Tools/skill-library`, or use the same `env` line.
3. Type `/skill-library`. The full guide is in [docs/guide.html](docs/guide.html).

To update, replace the folder with the new one (or `git pull`) and start a new session. Your names, types, hidden skills and counts are kept.

## Files

- `hooks/register.tsx`: the band, filters, scrolling, Use and Edit
- `hooks/links.ts`: reads descriptions, guesses each skill's type, writes the one line summary
- `hooks/icons.ts`: the symbol per type, on one Claude clay tile
- `hooks/links.test.ts`, `hooks/band.test.ts`: tests, run with `claude plugin test .`

## Look

- Motion lives only in the spark (desktop): it turns in as the library opens and breathes while Claude works on a turn. The type icons move a little under the pointer. Reduced motion keeps all of it still.
- Most used: the 3 skills you pick most sit at the top of Mine. On the terminal the first nine rows answer their number key.

- Two filters, two controls. Show picks where skills come from (Mine, Everything, or one plugin, biggest first); the tabs pick what they do (Build, Review, Write, Explore, Other). Show is hidden when there is only one source.

- One accent: Claude's clay (the `claude` theme colour). It marks the active filter, the ✻ mark and the row you point at. Everything else is neutral.
- Rows have no borders. Each is two lines (name, summary) so the list never jumps.
- The band loads 8 skills and the side panel 40; Load more adds the same again. On the terminal the tab row stays put and the wheel scrolls the list under it; the desktop scrolls the whole band natively (it never tells a mod about scrolling), so the tabs scroll with it there.
- Use and Edit are quiet text actions; Use lights up in clay on hover.

## License

MIT. Made by Sergi Font, Product Designer, with Claude Code. Also by me: [Notchy](https://github.com/Sfontfr97/Notchy), a status light for Claude Code in your MacBook's notch.
