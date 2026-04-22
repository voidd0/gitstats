#!/usr/bin/env node
// gitstats — git statistics CLI, free forever from vøiddo.
// https://voiddo.com/tools/gitstats/

const analyzer = require('../src/analyzer');
const { maybeShowPromo, getHelpFooter } = require('../src/promo');
const path = require('path');

const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const pkg = require('../package.json');
const args = process.argv.slice(2);

function getArg(names, defaultVal = null) {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
      return args[idx + 1];
    }
  }
  return defaultVal;
}

function hasFlag(names) {
  return names.some((n) => args.includes(n));
}

function getPath() {
  for (const arg of args) {
    if (!arg.startsWith('-') && (arg.startsWith('/') || arg.startsWith('.') || arg.startsWith('~'))) {
      return path.resolve(arg);
    }
  }
  return process.cwd();
}

function formatNumber(n) {
  return (n || 0).toLocaleString();
}

function makeBar(value, max, width = 20) {
  const safeMax = Math.max(max, 1);
  const filled = Math.max(0, Math.min(width, Math.round((value / safeMax) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function showHelp() {
  console.log(`
${YELLOW}gitstats${RESET} ${DIM}v${pkg.version}${RESET}
${DIM}git statistics CLI — free forever from vøiddo${RESET}

${CYAN}Usage:${RESET}
  gitstats [path] [metrics...] [filters...] [format]

${CYAN}Metrics:${RESET}
  --summary              Quick one-block overview (default when no metric is picked)
  -l, --loc              Lines of code by extension
  -c, --commits          Commits by month
  --contributors         Contributors leaderboard
  -H, --heatmap          Activity heatmap (52 weeks, ASCII)
  --hotspots             Most-changed files (bug hotspot / churn analysis)
  --bus-factor           How many authors cover 50% of commits
  --weekday              Commit distribution by day of week
  --hours                Commit distribution by hour of day (0-23)
  --burn                 Additions vs deletions per month
  --releases             Release cadence (time between git tags)
  --streak               Longest + current daily commit streak
  --coauthors            Co-Authored-By leaderboard
  -a, --author <name>    Per-author stats (use alone or with other metrics)

${CYAN}Filters:${RESET}
  --since <date>         Only include commits on/after this date
  --until <date>         Only include commits on/before this date
  --last-month           Alias for --since <30 days ago>
  --last-year            Alias for --since <1 year ago>
  --range <rev1..rev2>   Limit to a ref range (e.g. v1.0..v2.0)

${CYAN}Output:${RESET}
  --json                 Emit JSON (respects --hotspots / --bus-factor / --streak etc)
  --csv                  Emit CSV (contributors, loc, or summary)
  --top <N>              Limit rows for hotspots/contributors (default 20)
  -h, --help             Show this help
  --version              Show version

${CYAN}Examples:${RESET}
  gitstats
  gitstats /path/to/repo
  gitstats --loc --commits --heatmap
  gitstats --hotspots --top 30
  gitstats --bus-factor
  gitstats --streak --author "Jane Doe"
  gitstats --releases
  gitstats --range v1.0.0..v2.0.0 --contributors
  gitstats --json --hotspots | jq '.[0]'

${DIM}docs: https://voiddo.com/tools/gitstats/${RESET}${getHelpFooter()}
`);
}

function printSummary(cwd, options) {
  const repoName = analyzer.getRepoName(cwd);
  const commits = analyzer.getCommitCount(cwd, options);
  const contributors = analyzer.getContributors(cwd, options);
  const firstCommit = analyzer.getFirstCommit(cwd);
  const lastCommit = analyzer.getLastCommit(cwd);
  const lastCommitRel = analyzer.getLastCommitRelative(cwd);

  console.log(`
  ${CYAN}SUMMARY${RESET}
  ${DIM}${'─'.repeat(7)}${RESET}
  Repository:   ${repoName}
  Commits:      ${formatNumber(commits)}
  Contributors: ${contributors.length}
  First commit: ${firstCommit || 'N/A'}
  Last commit:  ${lastCommit || 'N/A'} ${lastCommitRel ? DIM + '(' + lastCommitRel + ')' + RESET : ''}
`);
}

function printLoc(cwd) {
  const loc = analyzer.getLinesOfCode(cwd);
  const sorted = Object.entries(loc.byExtension).sort((a, b) => b[1] - a[1]);
  const max = sorted[0] ? sorted[0][1] : 1;

  console.log(`  ${CYAN}LINES OF CODE${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(13)}${RESET}`);

  for (const [ext, lines] of sorted.slice(0, 15)) {
    const pct = loc.total ? ((lines / loc.total) * 100).toFixed(0) : '0';
    const bar = makeBar(lines, max);
    console.log(`  ${ext.padEnd(8)} ${formatNumber(lines).padStart(8)}  ${CYAN}${bar}${RESET}  ${pct}%`);
  }
  if (sorted.length > 15) {
    console.log(`  ${DIM}... and ${sorted.length - 15} more${RESET}`);
  }
  console.log(`  ${DIM}${'─'.repeat(45)}${RESET}`);
  console.log(`  ${'Total:'.padEnd(8)} ${formatNumber(loc.total).padStart(8)} lines`);
  console.log();
}

function printContributors(cwd, options, top = 10) {
  const contributors = analyzer.getContributors(cwd, options);
  const max = contributors[0] ? contributors[0].commits : 1;

  console.log(`  ${CYAN}TOP CONTRIBUTORS${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(16)}${RESET}`);

  for (let i = 0; i < Math.min(top, contributors.length); i++) {
    const c = contributors[i];
    const bar = makeBar(c.commits, max, 16);
    console.log(
      `  ${String(i + 1).padStart(2)}. ${c.name.padEnd(20)} ${formatNumber(c.commits).padStart(6)} commits  ${CYAN}${bar}${RESET}`
    );
  }
  if (contributors.length > top) {
    console.log(`  ${DIM}... and ${contributors.length - top} more${RESET}`);
  }
  console.log();
}

function printHeatmap(cwd, options) {
  const commitsByDay = analyzer.getCommitsByDay(cwd, { ...options, days: 364 });
  const heatmap = analyzer.generateHeatmap(commitsByDay, 52);

  console.log(`  ${CYAN}COMMIT HEATMAP${RESET} ${DIM}(last 52 weeks)${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(14)}${RESET}`);
  for (const line of heatmap) console.log(`  ${line}`);
  console.log();
  console.log(`  ${DIM}Less${RESET}  ░ ▒ ▓ █  ${DIM}More${RESET}`);
  console.log();
}

function printCommits(cwd, options) {
  const byMonth = analyzer.getCommitsByMonth(cwd, options);
  const sorted = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...sorted.map((x) => x[1]));

  console.log(`  ${CYAN}COMMITS BY MONTH${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(16)}${RESET}`);
  for (const [month, count] of sorted.slice(-12)) {
    const bar = makeBar(count, max, 30);
    console.log(`  ${month}  ${formatNumber(count).padStart(5)}  ${CYAN}${bar}${RESET}`);
  }
  console.log();
}

function printAuthorStats(cwd, author) {
  const stats = analyzer.getAuthorStats(cwd, author);

  console.log(`  ${CYAN}AUTHOR STATS${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(12)}${RESET}`);
  console.log(`  Author:      ${stats.author}`);
  console.log(`  Commits:     ${formatNumber(stats.commits)}`);
  console.log(`  First:       ${stats.firstCommit || 'N/A'}`);
  console.log(`  Last:        ${stats.lastCommit || 'N/A'}`);
  console.log(`  Additions:   ${GREEN}+${formatNumber(stats.additions)}${RESET}`);
  console.log(`  Deletions:   ${RED}-${formatNumber(stats.deletions)}${RESET}`);
  console.log(`  Net:         ${formatNumber(stats.additions - stats.deletions)}`);
  console.log();
}

function printHotspots(cwd, options, top = 20) {
  const hs = analyzer.getHotspots(cwd, options, top);
  if (!hs.length) {
    console.log(`  ${DIM}No files changed in the selected range.${RESET}`);
    return;
  }
  const max = hs[0].changes;
  console.log(`  ${CYAN}HOTSPOTS${RESET} ${DIM}(most-changed files)${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(8)}${RESET}`);
  for (const { file, changes } of hs) {
    const bar = makeBar(changes, max, 14);
    console.log(`  ${formatNumber(changes).padStart(5)}  ${CYAN}${bar}${RESET}  ${file}`);
  }
  console.log();
}

function printBusFactor(cwd, options) {
  const bf = analyzer.getBusFactor(cwd, options);
  console.log(`  ${CYAN}BUS FACTOR${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(10)}${RESET}`);
  console.log(`  ${bf.factor} author(s) cover 50% of ${formatNumber(bf.totalCommits)} commits.`);
  for (const a of bf.authorsCovering) {
    const pct = bf.totalCommits ? ((a.commits / bf.totalCommits) * 100).toFixed(1) : '0';
    console.log(`    ${DIM}•${RESET} ${a.name.padEnd(22)} ${formatNumber(a.commits).padStart(6)}  ${pct}%`);
  }
  console.log();
  if (bf.factor <= 1) {
    console.log(`  ${YELLOW}⚠  bus factor of 1 — a single author owns half the repo.${RESET}`);
    console.log();
  }
}

function printWeekday(cwd, options) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = analyzer.getCommitsByWeekday(cwd, options);
  const max = Math.max(1, ...counts);
  console.log(`  ${CYAN}COMMITS BY WEEKDAY${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(18)}${RESET}`);
  for (let i = 0; i < 7; i++) {
    const bar = makeBar(counts[i], max, 30);
    console.log(`  ${labels[i]}  ${formatNumber(counts[i]).padStart(5)}  ${CYAN}${bar}${RESET}`);
  }
  console.log();
}

function printHours(cwd, options) {
  const counts = analyzer.getCommitsByHour(cwd, options);
  const max = Math.max(1, ...counts);
  console.log(`  ${CYAN}COMMITS BY HOUR${RESET} ${DIM}(local of each commit)${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(15)}${RESET}`);
  for (let h = 0; h < 24; h++) {
    const bar = makeBar(counts[h], max, 30);
    const hh = String(h).padStart(2, '0');
    console.log(`  ${hh}:00  ${formatNumber(counts[h]).padStart(5)}  ${CYAN}${bar}${RESET}`);
  }
  console.log();
}

function printBurn(cwd, options) {
  const burn = analyzer.getBurndown(cwd, options);
  const months = Object.keys(burn).sort();
  const max = Math.max(1, ...months.map((m) => burn[m].additions + burn[m].deletions));
  console.log(`  ${CYAN}BURNDOWN${RESET} ${DIM}(additions vs deletions per month)${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(8)}${RESET}`);
  for (const m of months.slice(-12)) {
    const a = burn[m].additions;
    const d = burn[m].deletions;
    const aBar = '█'.repeat(Math.round((a / max) * 20));
    const dBar = '█'.repeat(Math.round((d / max) * 20));
    console.log(`  ${m}  ${GREEN}${aBar}${RESET}${RED}${dBar}${RESET}  ${GREEN}+${formatNumber(a)}${RESET} ${RED}-${formatNumber(d)}${RESET}`);
  }
  console.log();
}

function printReleases(cwd) {
  const rel = analyzer.getReleaseCadence(cwd);
  if (!rel.tags.length) {
    console.log(`  ${DIM}No git tags in this repo.${RESET}`);
    return;
  }
  console.log(`  ${CYAN}RELEASES${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(8)}${RESET}`);
  for (const t of rel.tags.slice(-10)) {
    console.log(`  ${t.name.padEnd(20)} ${DIM}${t.date}${RESET}`);
  }
  if (rel.gaps.length) {
    console.log();
    console.log(`  ${DIM}Average gap between releases: ${rel.avgDays} day(s).${RESET}`);
    console.log(`  ${DIM}Recent gaps:${RESET}`);
    for (const g of rel.gaps.slice(-5)) {
      console.log(`    ${g.from} → ${g.to}: ${g.days} day(s)`);
    }
  }
  console.log();
}

function printStreak(cwd, options) {
  const s = analyzer.getStreak(cwd, options);
  console.log(`  ${CYAN}COMMIT STREAK${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(13)}${RESET}`);
  console.log(`  Longest: ${MAGENTA}${s.longest}${RESET} consecutive days` + (s.longestRange ? ` (${s.longestRange.from} → ${s.longestRange.to})` : ''));
  console.log(`  Current: ${s.current > 0 ? GREEN : DIM}${s.current}${RESET} day(s)`);
  console.log();
}

function printCoauthors(cwd, options, top = 20) {
  const co = analyzer.getCoauthors(cwd, options);
  if (!co.length) {
    console.log(`  ${DIM}No Co-Authored-By trailers found.${RESET}`);
    return;
  }
  const max = co[0].commits;
  console.log(`  ${CYAN}CO-AUTHORS${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(10)}${RESET}`);
  for (const { coauthor, commits } of co.slice(0, top)) {
    const bar = makeBar(commits, max, 16);
    console.log(`  ${formatNumber(commits).padStart(5)}  ${CYAN}${bar}${RESET}  ${coauthor}`);
  }
  console.log();
}

function outputJson(cwd, options, picks) {
  const data = {};
  if (picks.summary || picks.all) {
    data.summary = {
      repository: analyzer.getRepoName(cwd),
      commits: analyzer.getCommitCount(cwd, options),
      contributors: analyzer.getContributors(cwd, options).length,
      firstCommit: analyzer.getFirstCommit(cwd),
      lastCommit: analyzer.getLastCommit(cwd),
    };
  }
  if (picks.loc || picks.all) data.linesOfCode = analyzer.getLinesOfCode(cwd);
  if (picks.contributors || picks.all) data.contributors = analyzer.getContributors(cwd, options);
  if (picks.commits) data.commitsByMonth = analyzer.getCommitsByMonth(cwd, options);
  if (picks.heatmap) data.commitsByDay = analyzer.getCommitsByDay(cwd, options);
  if (picks.hotspots) data.hotspots = analyzer.getHotspots(cwd, options, picks.top);
  if (picks.busFactor) data.busFactor = analyzer.getBusFactor(cwd, options);
  if (picks.weekday) data.commitsByWeekday = analyzer.getCommitsByWeekday(cwd, options);
  if (picks.hours) data.commitsByHour = analyzer.getCommitsByHour(cwd, options);
  if (picks.burn) data.burndown = analyzer.getBurndown(cwd, options);
  if (picks.releases) data.releases = analyzer.getReleaseCadence(cwd);
  if (picks.streak) data.streak = analyzer.getStreak(cwd, options);
  if (picks.coauthors) data.coauthors = analyzer.getCoauthors(cwd, options);
  if (picks.author) data.author = analyzer.getAuthorStats(cwd, picks.author);

  console.log(JSON.stringify(data, null, 2));
}

function outputCsv(cwd, options, picks) {
  if (picks.contributors) {
    console.log('name,email,commits');
    for (const c of analyzer.getContributors(cwd, options)) {
      console.log(`"${c.name}","${c.email}",${c.commits}`);
    }
  } else if (picks.loc) {
    const loc = analyzer.getLinesOfCode(cwd);
    console.log('extension,lines');
    for (const [ext, lines] of Object.entries(loc.byExtension)) {
      console.log(`${ext},${lines}`);
    }
  } else if (picks.hotspots) {
    console.log('file,changes');
    for (const h of analyzer.getHotspots(cwd, options, picks.top)) {
      console.log(`"${h.file}",${h.changes}`);
    }
  } else {
    console.log('metric,value');
    console.log(`commits,${analyzer.getCommitCount(cwd, options)}`);
    console.log(`contributors,${analyzer.getContributors(cwd, options).length}`);
    console.log(`lines,${analyzer.getLinesOfCode(cwd).total}`);
  }
}

function run() {
  if (hasFlag(['--version'])) {
    console.log(pkg.version);
    return;
  }

  if (hasFlag(['-h', '--help'])) {
    showHelp();
    return;
  }

  const cwd = getPath();

  if (!analyzer.isGitRepo(cwd)) {
    console.error(`\n  ${RED}bruh. that's not a git repository${RESET}`);
    console.error(`  ${DIM}Run this in a git repo or provide a path to one${RESET}\n`);
    process.exit(1);
  }

  const options = {};

  if (hasFlag(['--last-month'])) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    options.since = d.toISOString().split('T')[0];
  } else if (hasFlag(['--last-year'])) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    options.since = d.toISOString().split('T')[0];
  } else {
    const since = getArg(['--since']);
    const until = getArg(['--until']);
    if (since) options.since = since;
    if (until) options.until = until;
  }

  const range = getArg(['--range']);
  if (range) options.range = range;

  const author = getArg(['-a', '--author']);
  if (author) options.author = author;

  const top = parseInt(getArg(['--top'], '20'), 10);

  const picks = {
    loc: hasFlag(['-l', '--loc']),
    commits: hasFlag(['-c', '--commits']),
    contributors: hasFlag(['--contributors', '--contrib']),
    heatmap: hasFlag(['-H', '--heatmap']),
    summary: hasFlag(['--summary']),
    hotspots: hasFlag(['--hotspots']),
    busFactor: hasFlag(['--bus-factor']),
    weekday: hasFlag(['--weekday']),
    hours: hasFlag(['--hours']),
    burn: hasFlag(['--burn']),
    releases: hasFlag(['--releases']),
    streak: hasFlag(['--streak']),
    coauthors: hasFlag(['--coauthors']),
    author,
    top,
  };

  const anyPicked = Object.values(picks).some((v) => typeof v === 'boolean' && v);
  picks.all = !anyPicked && !author;

  if (hasFlag(['--json'])) {
    outputJson(cwd, options, picks);
    return;
  }

  if (hasFlag(['--csv'])) {
    outputCsv(cwd, options, picks);
    return;
  }

  console.log();
  console.log(`  ${YELLOW}gitstats${RESET} ${DIM}— voiddo.com/tools/gitstats${RESET}`);
  console.log(`  ${DIM}${'─'.repeat(28)}${RESET}`);

  if (author && !anyPicked) {
    printAuthorStats(cwd, author);
    maybeShowPromo();
    return;
  }

  if (picks.all || picks.summary) printSummary(cwd, options);
  if (picks.all || picks.loc) printLoc(cwd);
  if (picks.all || picks.contributors) printContributors(cwd, options, top);
  if (picks.commits) printCommits(cwd, options);
  if (picks.heatmap) printHeatmap(cwd, options);
  if (picks.hotspots) printHotspots(cwd, options, top);
  if (picks.busFactor) printBusFactor(cwd, options);
  if (picks.weekday) printWeekday(cwd, options);
  if (picks.hours) printHours(cwd, options);
  if (picks.burn) printBurn(cwd, options);
  if (picks.releases) printReleases(cwd);
  if (picks.streak) printStreak(cwd, options);
  if (picks.coauthors) printCoauthors(cwd, options, top);
  if (author) printAuthorStats(cwd, author);

  maybeShowPromo();
}

run();
