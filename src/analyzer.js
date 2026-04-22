// gitstats — free forever from vøiddo. https://voiddo.com/tools/gitstats/
// Git statistics analyzer: every shell-out is argv-based (spawnSync) so user-supplied
// author/date/rev values cannot escape into the shell.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function git(args, cwd) {
  const res = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (res.error || res.status !== 0) return '';
  return (res.stdout || '').trim();
}

function isGitRepo(cwd) {
  const res = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return !res.error && res.status === 0;
}

function getRepoName(cwd) {
  const remote = git(['remote', 'get-url', 'origin'], cwd);
  if (remote) {
    const match = remote.match(/\/([^\/]+?)(\.git)?$/);
    if (match) return match[1];
  }
  return path.basename(cwd);
}

function withFilters(args, options = {}) {
  const out = [...args];
  if (options.author) out.push(`--author=${options.author}`);
  if (options.since) out.push(`--since=${options.since}`);
  if (options.until) out.push(`--until=${options.until}`);
  if (options.range) out.push(options.range);
  return out;
}

function getCommitCount(cwd, options = {}) {
  const base = ['rev-list', '--count', options.range || 'HEAD'];
  const args = withFilters(base, { ...options, range: undefined });
  return parseInt(git(args, cwd), 10) || 0;
}

function getContributors(cwd, options = {}) {
  const base = ['shortlog', '-sne', options.range || 'HEAD'];
  const args = withFilters(base, { ...options, range: undefined });
  const log = git(args, cwd);
  return log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(.+)\s+<(.+)>$/);
      if (match) {
        return {
          commits: parseInt(match[1], 10),
          name: match[2].trim(),
          email: match[3],
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.commits - a.commits);
}

function getLinesOfCode(cwd) {
  const files = git(['ls-files'], cwd).split('\n').filter(Boolean);
  const stats = {};
  let total = 0;

  const binaryExts = [
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg',
    'woff', 'woff2', 'ttf', 'eot', 'otf',
    'mp3', 'mp4', 'mov', 'webm', 'ogg',
    'zip', 'tar', 'gz', 'bz2', 'xz', '7z',
    'pdf', 'dmg', 'exe', 'bin', 'so', 'dylib', 'dll',
    'class', 'jar', 'war', 'o', 'a',
    'webp', 'avif', 'heic',
  ];

  for (const file of files) {
    const ext = path.extname(file).slice(1).toLowerCase() || 'other';
    if (binaryExts.includes(ext)) continue;

    try {
      const full = path.join(cwd, file);
      const stat = fs.statSync(full);
      if (stat.size > 5 * 1024 * 1024) continue;
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n').length;
      stats[ext] = (stats[ext] || 0) + lines;
      total += lines;
    } catch {}
  }

  return { byExtension: stats, total };
}

function getCommitsByDay(cwd, options = {}) {
  const days = options.days || 365;
  const base = ['log', '--format=%ad', '--date=format:%Y-%m-%d'];
  if (!options.since) base.push(`--since=${days} days ago`);
  const args = withFilters(base, options);
  const log = git(args, cwd);
  const dates = log.split('\n').filter(Boolean);
  const counts = {};
  for (const date of dates) {
    counts[date] = (counts[date] || 0) + 1;
  }
  return counts;
}

function getCommitsByMonth(cwd, options = {}) {
  const base = ['log', '--format=%ad', '--date=format:%Y-%m'];
  const args = withFilters(base, options);
  const log = git(args, cwd);
  const months = log.split('\n').filter(Boolean);
  const counts = {};
  for (const m of months) counts[m] = (counts[m] || 0) + 1;
  return counts;
}

function getCommitsByWeekday(cwd, options = {}) {
  const base = ['log', '--format=%ad', '--date=format:%w'];
  const args = withFilters(base, options);
  const log = git(args, cwd);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const w of log.split('\n').filter(Boolean)) {
    const idx = parseInt(w, 10);
    if (idx >= 0 && idx < 7) counts[idx]++;
  }
  return counts;
}

function getCommitsByHour(cwd, options = {}) {
  const base = ['log', '--format=%ad', '--date=format:%H'];
  const args = withFilters(base, options);
  const log = git(args, cwd);
  const counts = new Array(24).fill(0);
  for (const h of log.split('\n').filter(Boolean)) {
    const idx = parseInt(h, 10);
    if (idx >= 0 && idx < 24) counts[idx]++;
  }
  return counts;
}

function getFirstCommit(cwd) {
  const out = git(['log', '--reverse', '--format=%ad', '--date=short'], cwd);
  const first = out.split('\n').filter(Boolean)[0];
  return first || null;
}

function getLastCommit(cwd) {
  const out = git(['log', '-1', '--format=%ad', '--date=short'], cwd);
  return out || null;
}

function getLastCommitRelative(cwd) {
  const out = git(['log', '-1', '--format=%ar'], cwd);
  return out || null;
}

function generateHeatmap(commitsByDay, weeks = 52) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const blocks = [' ', '░', '▒', '▓', '█'];

  const today = new Date();
  const grid = [];
  for (let w = 0; w < weeks; w++) {
    grid[w] = [0, 0, 0, 0, 0, 0, 0];
  }

  const maxCommits = Math.max(1, ...Object.values(commitsByDay));

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = commitsByDay[dateStr] || 0;

    const week = weeks - 1 - Math.floor(i / 7);
    const day = date.getDay();

    if (week >= 0 && week < weeks) {
      grid[week][day] = count;
    }
  }

  const lines = [];
  for (let d = 0; d < 7; d++) {
    let line = days[d] + ' ';
    for (let w = 0; w < weeks; w++) {
      const count = grid[w][d];
      const level = Math.min(4, Math.floor((count / maxCommits) * 4));
      line += blocks[level];
    }
    lines.push(line);
  }
  return lines;
}

function getAuthorStats(cwd, author) {
  const commits = getCommitCount(cwd, { author });
  const firstOut = git(
    ['log', '--reverse', `--author=${author}`, '--format=%ad', '--date=short'],
    cwd
  );
  const first = firstOut.split('\n').filter(Boolean)[0] || null;
  const last = git(['log', `--author=${author}`, '-1', '--format=%ad', '--date=short'], cwd) || null;

  const numstat = git(
    ['log', `--author=${author}`, '--pretty=tformat:', '--numstat'],
    cwd
  );
  let additions = 0;
  let deletions = 0;
  for (const line of numstat.split('\n')) {
    const parts = line.split('\t');
    if (parts.length >= 2) {
      const a = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      if (!Number.isNaN(a)) additions += a;
      if (!Number.isNaN(d)) deletions += d;
    }
  }

  return {
    author,
    commits,
    firstCommit: first,
    lastCommit: last,
    additions,
    deletions,
  };
}

function getHotspots(cwd, options = {}, top = 20) {
  const base = ['log', '--name-only', '--pretty=format:'];
  const args = withFilters(base, options);
  const log = git(args, cwd);
  const counts = {};
  for (const f of log.split('\n').map((s) => s.trim()).filter(Boolean)) {
    counts[f] = (counts[f] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([file, changes]) => ({ file, changes }))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, top);
}

function getBusFactor(cwd, options = {}) {
  const contribs = getContributors(cwd, options);
  if (!contribs.length) return { factor: 0, authorsCovering: [], threshold: 0.5, totalCommits: 0 };
  const total = contribs.reduce((s, c) => s + c.commits, 0);
  const half = total * 0.5;
  let running = 0;
  const covering = [];
  for (const c of contribs) {
    running += c.commits;
    covering.push(c);
    if (running >= half) break;
  }
  return {
    factor: covering.length,
    authorsCovering: covering,
    threshold: 0.5,
    totalCommits: total,
  };
}

function getStreak(cwd, options = {}) {
  const byDay = getCommitsByDay(cwd, { ...options, days: options.days || 3650 });
  const days = Object.keys(byDay).sort();
  if (!days.length) return { longest: 0, current: 0, longestRange: null };

  let longest = 0;
  let current = 1;
  let longestStart = days[0];
  let longestEnd = days[0];
  let runStart = days[0];

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const cur = new Date(days[i]);
    const diff = Math.round((cur - prev) / (86400 * 1000));
    if (diff === 1) {
      current++;
    } else {
      if (current > longest) {
        longest = current;
        longestStart = runStart;
        longestEnd = days[i - 1];
      }
      current = 1;
      runStart = days[i];
    }
  }
  if (current > longest) {
    longest = current;
    longestStart = runStart;
    longestEnd = days[days.length - 1];
  }

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let currentStreak = 0;
  if (byDay[today] || byDay[yesterday]) {
    let cursor = byDay[today] ? today : yesterday;
    while (byDay[cursor]) {
      currentStreak++;
      const d = new Date(cursor);
      d.setDate(d.getDate() - 1);
      cursor = d.toISOString().split('T')[0];
    }
  }

  return {
    longest,
    current: currentStreak,
    longestRange: { from: longestStart, to: longestEnd },
  };
}

function getReleaseCadence(cwd) {
  const tagsOut = git(['for-each-ref', '--sort=creatordate', '--format=%(refname:short)|%(creatordate:iso8601)', 'refs/tags'], cwd);
  const tags = tagsOut
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [name, date] = l.split('|');
      return { name, date, ts: Date.parse(date) };
    })
    .filter((t) => !Number.isNaN(t.ts));
  const gaps = [];
  for (let i = 1; i < tags.length; i++) {
    const days = Math.round((tags[i].ts - tags[i - 1].ts) / 86400000);
    gaps.push({ from: tags[i - 1].name, to: tags[i].name, days });
  }
  const avgDays = gaps.length
    ? Math.round(gaps.reduce((s, g) => s + g.days, 0) / gaps.length)
    : null;
  return { tags, gaps, avgDays };
}

function getCoauthors(cwd, options = {}) {
  const base = ['log', '--format=%(trailers:key=Co-authored-by,valueonly=true)'];
  const args = withFilters(base, options);
  const log = git(args, cwd);
  const counts = {};
  for (const line of log.split('\n').map((s) => s.trim()).filter(Boolean)) {
    counts[line] = (counts[line] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([coauthor, commits]) => ({ coauthor, commits }))
    .sort((a, b) => b.commits - a.commits);
}

function getBurndown(cwd, options = {}) {
  const base = ['log', '--pretty=format:COMMIT %ad', '--date=format:%Y-%m', '--numstat'];
  const args = withFilters(base, options);
  const log = git(args, cwd);
  const byMonth = {};
  let currentMonth = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('COMMIT ')) {
      currentMonth = line.slice(7).trim();
      if (!byMonth[currentMonth]) byMonth[currentMonth] = { additions: 0, deletions: 0 };
      continue;
    }
    const parts = line.split('\t');
    if (parts.length >= 2 && currentMonth) {
      const a = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      if (!Number.isNaN(a)) byMonth[currentMonth].additions += a;
      if (!Number.isNaN(d)) byMonth[currentMonth].deletions += d;
    }
  }
  return byMonth;
}

module.exports = {
  isGitRepo,
  getRepoName,
  getCommitCount,
  getContributors,
  getLinesOfCode,
  getCommitsByDay,
  getCommitsByMonth,
  getCommitsByWeekday,
  getCommitsByHour,
  getFirstCommit,
  getLastCommit,
  getLastCommitRelative,
  generateHeatmap,
  getAuthorStats,
  getHotspots,
  getBusFactor,
  getStreak,
  getReleaseCadence,
  getCoauthors,
  getBurndown,
};
