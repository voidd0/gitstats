// gitstats — tests. free forever from vøiddo. https://voiddo.com/tools/gitstats/

const analyzer = require('./src/analyzer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('\x1b[32m✓ ' + name + '\x1b[0m');
    passed++;
  } catch (e) {
    console.log('\x1b[31m✗ ' + name + '\x1b[0m');
    console.log('  ' + e.message);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Create a temp git repo for testing
const tmpDir = path.join(os.tmpdir(), 'gitstats-test-' + Date.now());
fs.mkdirSync(tmpDir);

function setupTestRepo() {
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: 'pipe' });

  fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\nconsole.log("world");\n');
  fs.writeFileSync(path.join(tmpDir, 'style.css'), 'body { color: red; }\n');
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n\nThis is a test.\n');

  execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });

  fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\nconsole.log("world");\nconsole.log("!");\n');
  execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "second commit"', { cwd: tmpDir, stdio: 'pipe' });
}

function cleanupTestRepo() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

// Setup
setupTestRepo();

// Tests
test('isGitRepo returns true for git directory', () => {
  assert(analyzer.isGitRepo(tmpDir) === true, 'Should detect git repo');
});

test('isGitRepo returns false for non-git directory', () => {
  assert(analyzer.isGitRepo('/tmp') === false, 'Should return false for non-git dir');
});

test('getRepoName returns directory name', () => {
  const name = analyzer.getRepoName(tmpDir);
  assert(name.includes('gitstats-test'), 'Should return repo name');
});

test('getCommitCount returns number', () => {
  const count = analyzer.getCommitCount(tmpDir);
  assert(typeof count === 'number', 'Should return number');
  assert(count === 2, 'Should have 2 commits');
});

test('getCommitCount filters by author', () => {
  const count = analyzer.getCommitCount(tmpDir, { author: 'Test User' });
  assert(count === 2, 'Should filter by author');

  const countNone = analyzer.getCommitCount(tmpDir, { author: 'Nobody' });
  assert(countNone === 0, 'Should return 0 for unknown author');
});

test('getContributors returns array', () => {
  const contributors = analyzer.getContributors(tmpDir);
  assert(Array.isArray(contributors), 'Should return array');
  assert(contributors.length > 0, 'Should have contributors');
  assert(contributors[0].name, 'Should have name');
  assert(contributors[0].email, 'Should have email');
  assert(contributors[0].commits, 'Should have commits');
});

test('getLinesOfCode returns object by extension', () => {
  const loc = analyzer.getLinesOfCode(tmpDir);
  assert(typeof loc === 'object', 'Should return object');
  assert(loc.byExtension, 'Should have byExtension');
  assert(loc.total > 0, 'Should have total');
  assert(loc.byExtension.js > 0, 'Should count js lines');
  assert(loc.byExtension.css > 0, 'Should count css lines');
});

test('getCommitsByDay returns object', () => {
  const byDay = analyzer.getCommitsByDay(tmpDir);
  assert(typeof byDay === 'object', 'Should return object');
});

test('getFirstCommit returns date string', () => {
  const first = analyzer.getFirstCommit(tmpDir);
  assert(first !== null, 'Should return date');
  assert(/\d{4}-\d{2}-\d{2}/.test(first), 'Should be date format');
});

test('getLastCommit returns date string', () => {
  const last = analyzer.getLastCommit(tmpDir);
  assert(last !== null, 'Should return date');
  assert(/\d{4}-\d{2}-\d{2}/.test(last), 'Should be date format');
});

test('generateHeatmap returns array of strings', () => {
  const commitsByDay = analyzer.getCommitsByDay(tmpDir);
  const heatmap = analyzer.generateHeatmap(commitsByDay, 52);
  assert(Array.isArray(heatmap), 'Should return array');
  assert(heatmap.length === 7, 'Should have 7 rows (days)');
  assert(heatmap[0].startsWith('Sun'), 'First row should be Sunday');
});

test('getCommitsByMonth returns object', () => {
  const byMonth = analyzer.getCommitsByMonth(tmpDir);
  assert(typeof byMonth === 'object', 'Should return object');
});

test('getAuthorStats returns stats object', () => {
  const stats = analyzer.getAuthorStats(tmpDir, 'Test User');
  assert(stats.author === 'Test User', 'Should have author');
  assert(stats.commits === 2, 'Should have 2 commits');
  assert(stats.additions >= 0, 'Should have additions');
});

test('handles non-git directory gracefully', () => {
  const count = analyzer.getCommitCount('/tmp');
  assert(count === 0, 'Should return 0 for non-git dir');

  const contributors = analyzer.getContributors('/tmp');
  assert(contributors.length === 0, 'Should return empty array');
});

test('filters by since date', () => {
  const futureDate = '2099-01-01';
  const count = analyzer.getCommitCount(tmpDir, { since: futureDate });
  assert(count === 0, 'Should return 0 for future date');
});

// Cleanup
cleanupTestRepo();

console.log('\n' + passed + '/' + (passed + failed) + ' tests passed\n');

if (failed > 0) process.exit(1);
