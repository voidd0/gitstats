# gitstats

**Local git analytics, no signup, no remote.** Run it in any repo and get an instant read on the codebase — LOC, contributors, commit heatmap, bug hotspots, bus factor, streaks, release cadence, burndown.

Free forever gift from [vøiddo](https://voiddo.com).

```
  gitstats — voiddo.com/tools/gitstats
  ────────────────────────────

  SUMMARY
  ───────
  Repository:   my-repo
  Commits:      1,423
  Contributors: 7
  First commit: 2023-11-02
  Last commit:  2026-04-22 (3 hours ago)

  HOTSPOTS (most-changed files)
  ────────
     87  ██████████████  src/api/router.py
     61  █████████░░░░░  src/models/user.py
     54  ████████░░░░░░  src/services/billing.py
     ...

  BUS FACTOR
  ──────────
  2 author(s) cover 50% of 1423 commits.
    • Jane Doe              612  43.0%
    • John Smith            251  17.6%
```

## Why gitstats

`git log | wc -l` gives you one number. `cloc` doesn't know about history. GitHub's "Insights" tab is behind a login, and it lies by omission (no bus-factor, no streaks, no hotspots). gitstats runs locally in your terminal, reads only what `git` already tells it, and surfaces the metrics that actually help you ship.

## Install

```bash
npm install -g @v0idd0/gitstats
```

Or one-shot via `npx`:

```bash
npx -y @v0idd0/gitstats --hotspots --top 30
```

## Quickstart

```bash
# Full dashboard (summary + LOC + contributors)
gitstats

# Specific metrics
gitstats --loc --commits --heatmap
gitstats --hotspots --top 30
gitstats --bus-factor
gitstats --streak
gitstats --releases
gitstats --weekday --hours
gitstats --burn                      # additions vs deletions per month
gitstats --coauthors                 # Co-Authored-By leaderboard

# Per-author deep-dive
gitstats --author "Jane Doe"
gitstats --author "Jane Doe" --streak --hotspots

# Date / range filters
gitstats --since 2026-01-01 --until 2026-03-31 --contributors
gitstats --last-month
gitstats --last-year
gitstats --range v1.0.0..v2.0.0 --contributors --hotspots

# Machine output
gitstats --json --hotspots | jq '.hotspots[0]'
gitstats --csv --contributors > contributors.csv
```

## Metrics

| Flag | What it shows |
|------|---------------|
| `--summary` | One-block overview: repo name, commit count, contributors, first/last commit |
| `-l, --loc` | Lines of code by extension, with bars + percentages |
| `-c, --commits` | Commits by month (last 12) |
| `--contributors` | Top contributors leaderboard with commit bars |
| `-H, --heatmap` | 52-week ASCII activity heatmap (GitHub-style) |
| `--hotspots` | Most-changed files (churn analysis, bug-hotspot signal) |
| `--bus-factor` | How many authors cover 50% of commits — low = risky |
| `--weekday` | Commit distribution by day of week |
| `--hours` | Commit distribution by hour of day (0–23) |
| `--burn` | Additions vs deletions per month (green vs red bars) |
| `--releases` | Git tag cadence — average gap between releases |
| `--streak` | Longest + current daily commit streak |
| `--coauthors` | Co-Authored-By trailer leaderboard |
| `-a, --author <name>` | Per-author stats: commits, first/last, additions, deletions, net |

## Filters

| Flag | Description |
|------|-------------|
| `--since <date>` | Include commits on/after this date |
| `--until <date>` | Include commits on/before this date |
| `--last-month` | Shortcut for `--since 30 days ago` |
| `--last-year` | Shortcut for `--since 1 year ago` |
| `--range <rev1..rev2>` | Limit to a ref range (e.g. `v1.0..v2.0`) |

## Output

| Flag | Description |
|------|-------------|
| `--json` | Emit the picked metrics as JSON |
| `--csv` | Emit contributors / LOC / hotspots / summary as CSV |
| `--top <N>` | Limit hotspots / contributors rows (default 20) |
| `-h, --help` | Show help |
| `--version` | Show version |

## Features worth calling out

### Hotspots — bug-hotspot signal
Counts how many commits touched each file. Files at the top of the list are where churn concentrates — where bugs cluster, where refactors avoid, where onboarding hits hardest. A classic signal from *Your Code as a Crime Scene*, computed in under a second on any repo.

### Bus factor
How many authors do you need to read to understand 50% of the repo's history? If the answer is 1, you have a people-risk problem, not a code problem. gitstats surfaces the raw number plus a ⚠ warning when it's ≤ 1.

### Streak
Longest and current consecutive-day commit streak. Useful for solo-dev retros, not as a productivity cudgel.

### Release cadence
Reads `refs/tags`, computes average gap between tags, and shows your last 5 release intervals. Useful for "are we shipping faster or slower than last quarter?" without pulling up GitHub.

### Burndown
Additions vs deletions per month as stacked green/red bars. Fast visual signal for "is this codebase growing unbounded or being maintained?"

### Range-aware everything
`--range v1.0..v2.0 --hotspots` tells you which files changed most between two releases. Great for changelog prep and regression risk review.

### Shell-injection-safe
Every `git` invocation uses `spawnSync('git', [...args])` — no shell interpolation — so `--author "x\"; rm -rf /"` is just a query with no matches, not a catastrophe.

## Programmatic use

```js
const analyzer = require('@v0idd0/gitstats/src/analyzer');

const hotspots = analyzer.getHotspots(process.cwd(), {}, 10);
const bf = analyzer.getBusFactor(process.cwd());
const streak = analyzer.getStreak(process.cwd());

console.log('top hotspot:', hotspots[0]);
console.log('bus factor:', bf.factor);
console.log('longest streak:', streak.longest);
```

Exports: `isGitRepo`, `getRepoName`, `getCommitCount`, `getContributors`, `getLinesOfCode`, `getCommitsByDay`, `getCommitsByMonth`, `getCommitsByWeekday`, `getCommitsByHour`, `getFirstCommit`, `getLastCommit`, `getLastCommitRelative`, `generateHeatmap`, `getAuthorStats`, `getHotspots`, `getBusFactor`, `getStreak`, `getReleaseCadence`, `getCoauthors`, `getBurndown`.

## From the same studio

vøiddo builds sharp, free-forever CLIs for devs who are tired of paywalls:

- [`@v0idd0/jsonyo`](https://voiddo.com/tools/jsonyo/) — JSON that yells at you when it's broken
- [`@v0idd0/tokcount`](https://voiddo.com/tools/tokcount/) — token counter for 60+ LLMs (GPT-5.4, Claude Opus 4.7, Gemini 3.1, Llama 4, Grok 4.1)
- [`@v0idd0/ctxstuff`](https://voiddo.com/tools/ctxstuff/) — stuff a repo into an LLM context window
- [`@v0idd0/promptdiff`](https://voiddo.com/tools/promptdiff/) — diff two prompts with token impact + word-frequency delta
- [`@v0idd0/httpwut`](https://voiddo.com/tools/httpwut/) — HTTP debugger with DNS/TCP/TLS phase timing

Full catalog: [voiddo.com/tools](https://voiddo.com/tools/).

## License

MIT © [vøiddo](https://voiddo.com) — free forever, no asterisks.

## Links

- Docs: https://voiddo.com/tools/gitstats/
- Source: https://github.com/voidd0/gitstats
- npm: https://npmjs.com/package/@v0idd0/gitstats
- Studio: https://voiddo.com
- Issues: https://github.com/voidd0/gitstats/issues
- Support: support@voiddo.com

---

Built by [vøiddo](https://voiddo.com/) — a small studio shipping AI-flavoured products, free dev tools, Chrome extensions and weird browser games.
