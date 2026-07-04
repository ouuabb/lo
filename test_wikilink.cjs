/**
 * WikiLink 全流程 E2E 测试
 */
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

const CLI = path.join(__dirname, 'src', 'cli.cjs');
const TEST_DIR = path.join(__dirname, `test_wlink_tmp_${Date.now()}`);

let passed = 0;
let failed = 0;
const failures = [];

function ok(msg) { passed++; console.log('  PASS  ' + msg); }
function fail(msg) { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
function assert(cond, msg) { cond ? ok(msg) : fail(msg); }

function run(args) {
  try {
    return execSync(`node "${CLI}" ${args}`, {
      cwd: TEST_DIR, timeout: 60000, maxBuffer: 20 * 1024 * 1024, encoding: 'utf8'
    });
  } catch (e) {
    if (e.stderr) console.error('STDERR:', e.stderr.substring(0, 500));
    return e.stdout || '';
  }
}

function dbQuery(sql, params = []) {
  return new Promise((resolve) => {
    // Try up to 5 times with increasing delays
    let attempt = 0;
    const tryQuery = () => {
      const db = new sqlite3.Database(path.join(TEST_DIR, '.repo', 'database.sqlite'));
      db.all(sql, params, (err, rows) => {
        db.close();
        if (err) {
          console.log('  DB error (attempt ' + (attempt+1) + '):', err.message);
          if (++attempt < 5) {
            setTimeout(tryQuery, 200 * attempt);
          } else {
            resolve([]);
          }
        } else {
          resolve(rows || []);
        }
      });
    };
    tryQuery();
  });
}

async function main() {
  console.log('=== WikiLink E2E Test ===\n');

  // ── Setup ──
  console.log('--- Setup ---');
  fs.mkdirsSync(TEST_DIR);
  run('init');
  assert(fs.existsSync(path.join(TEST_DIR, '.repo', 'database.sqlite')), 'DB created');
  
  // Verify relations table
  const testQuery = await dbQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='relations'");
  assert(testQuery.length === 1, 'relations table exists');
  if (testQuery.length === 0) { process.exit(1); }

  // ── 1. Create files ──
  console.log('\n--- 1. Create .md files ---');
  fs.writeFileSync(path.join(TEST_DIR, 'resources', 'A.md'), '# 笔记A\n\n参考 [[B]] 和 [[C]]。', 'utf8');
  fs.writeFileSync(path.join(TEST_DIR, 'resources', 'B.md'), '# 笔记B\n\n[[A]] 很有用。', 'utf8');
  fs.writeFileSync(path.join(TEST_DIR, 'resources', 'C.md'), '# 笔记C\n\n独立笔记。', 'utf8');
  fs.writeFileSync(path.join(TEST_DIR, 'resources', 'D.jpg'), 'fake data', 'utf8');
  ok('created 3 .md + 1 .jpg');

  // ── 2. Sync ──
  console.log('\n--- 2. lo sync (auto-import + wikilink) ---');
  const r2 = run('sync');
  assert(r2.includes('wikilink: 3'), 'sync reports 3 wikilinks');
  assert(r2.includes('A.md') && r2.includes('B.md') && r2.includes('C.md'), 'all .md files imported');

  // ── 3. DB verification ──
  console.log('\n--- 3. DB verification ---');
  const rels = await dbQuery("SELECT * FROM relations WHERE type='wikilink'");
  assert(rels.length === 3, `3 wikilink rows (got ${rels.length})`);

  const res = await dbQuery("SELECT rid, path, metadata FROM resources WHERE deleted=0");
  const byName = {};
  for (const r of res) {
    const meta = JSON.parse(r.metadata || '{}');
    byName[path.basename(r.path)] = { rid: r.rid, title: meta.title };
  }
  const ridA = byName['A.md'].rid;
  const ridB = byName['B.md'].rid;
  const ridC = byName['C.md'].rid;

  // A → B, A → C
  const aOut = rels.filter(r => r.from_rid === ridA);
  assert(aOut.length === 2, 'A outgoing = 2');
  const aTargets = new Set(aOut.map(r => r.to_rid));
  assert(aTargets.has(ridB) && aTargets.has(ridC), 'A links to B and C');

  // B → A
  const bOut = rels.filter(r => r.from_rid === ridB);
  assert(bOut.length === 1, 'B outgoing = 1');
  assert(bOut[0].to_rid === ridA, 'B links to A');

  // Backlinks
  const bBack = rels.filter(r => r.to_rid === ridB);
  assert(bBack.length === 1 && bBack[0].from_rid === ridA, 'B backlink is A');
  const aBack = rels.filter(r => r.to_rid === ridA);
  assert(aBack.length === 1 && aBack[0].from_rid === ridB, 'A backlink is B');

  // ── 4. Edit: update wikilinks (delete old, create new) ──
  console.log('\n--- 4. Edit A.md: [[B]]→[[C]] only ---');
  fs.writeFileSync(path.join(TEST_DIR, 'resources', 'A.md'), '# 笔记A\n\n只参考 [[C]]。', 'utf8');
  const r4 = run('sync');
  assert(r4.includes('wikilink: 1'), 're-parsed A: 1 wikilink');
  const aOut2 = await dbQuery("SELECT * FROM relations WHERE type='wikilink' AND from_rid=?", [ridA]);
  assert(aOut2.length === 1 && aOut2[0].to_rid === ridC, 'A now only links to C');

  // ── 5. Delete all wikilinks ──
  console.log('\n--- 5. Remove all wikilinks from A.md ---');
  fs.writeFileSync(path.join(TEST_DIR, 'resources', 'A.md'), '# 无链接', 'utf8');
  run('sync');
  const aOut3 = await dbQuery("SELECT * FROM relations WHERE type='wikilink' AND from_rid=?", [ridA]);
  assert(aOut3.length === 0, 'A wikilinks cleared');
  const bOut2 = await dbQuery("SELECT * FROM relations WHERE type='wikilink' AND from_rid=?", [ridB]);
  assert(bOut2.length === 1, 'B wikilink unaffected');

  // ── 6. --wikilinks full scan ──
  console.log('\n--- 6. lo sync --wikilinks (full scan) ---');
  const r6 = run('sync --wikilinks');
  assert(r6.includes('wikilink:'), 'full scan shows wikilink count');

  // ── 7. Alias syntax ──
  console.log('\n--- 7. [[Target|Alias]] → resolves by target name ---');
  fs.writeFileSync(path.join(TEST_DIR, 'resources', 'A.md'), '# 笔记A\n\n[[B|别名]]', 'utf8');
  run('sync --wikilinks');
  const aOut4 = await dbQuery("SELECT * FROM relations WHERE type='wikilink' AND from_rid=?", [ridA]);
  assert(aOut4.length === 1 && aOut4[0].to_rid === ridB, '[[B|alias]] resolves to B');

  // ── 8. Non-.md ignored ──
  console.log('\n--- 8. Non-.md files ignored ---');
  const jpgLinks = await dbQuery("SELECT * FROM relations r JOIN resources rs ON r.from_rid=rs.rid WHERE r.type='wikilink' AND rs.path LIKE '%.jpg'");
  assert(jpgLinks.length === 0, 'no wikilinks from .jpg');

  // ── 9. Rename preserves wikilink (RID-based) ──
  console.log('\n--- 9. File rename → wikilink survives ---');
  // 先删除可能存在的 B-renamed.md
  try { fs.unlinkSync(path.join(TEST_DIR, 'resources', 'B-renamed.md')); } catch(e) {}
  fs.moveSync(path.join(TEST_DIR, 'resources', 'B.md'), path.join(TEST_DIR, 'resources', 'B-renamed.md'));
  const r9 = run('sync');
  assert(r9.includes('重命名'), 'sync detects rename');
  const bOut3 = await dbQuery("SELECT * FROM relations WHERE type='wikilink' AND from_rid=?", [ridB]);
  assert(bOut3.length === 1, 'wikilink survives rename');

  // ── Results ──
  console.log(`\n========== ${passed} PASS / ${failed} FAIL ==========`);
  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log('  - ' + f));
  }
  
  // cleanup
  try { fs.removeSync(TEST_DIR); } catch(e) {}
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('CRASH:', e); process.exit(1); });
