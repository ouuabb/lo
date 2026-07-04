// 暂存区全流程测试 — 仅使用 lo 命令，不直接操作 SQLite
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const TEST_DIR = path.join(__dirname, 'test_tmp3');
const LO = `node "${path.join(__dirname, 'src', 'cli.cjs')}"`;

let passed = 0;
let failed = 0;

// 加密相关：读取 repo key 用于文件加解密
function getRepoKey() {
  const keyPath = path.join(TEST_DIR, '.repo', 'keys', 'repo.key');
  if (!fs.existsSync(keyPath)) return null;
  return fs.readFileSync(keyPath);
}

const MAGIC = Buffer.from('LOEC');

function decryptFile(filePath, key) {
  const raw = fs.readFileSync(filePath);
  if (raw.length < 4 || !raw.subarray(0, 4).equals(MAGIC)) {
    return raw; // 未加密，直接返回
  }
  // 解析 LOEC 格式
  const iv = raw.subarray(5, 17);      // 跳过 MAGIC(4) + VERSION(1)
  const authTag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(17, raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext;
}

function encryptFile(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, Buffer.from([0x01]), iv, ciphertext, authTag]);
}

let repoKey = null; // 延迟加载

function run(cmd, cwd = TEST_DIR) {
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 300000, maxBuffer: 10 * 1024 * 1024 });
    return { ok: true, out };
  } catch (e) {
    const errDetail = `[code=${e.status}, signal=${e.signal}, err=${(e.stderr || e.message || '').split('\n').slice(0,3).join(' | ')}]`;
    return { ok: false, out: e.stdout || '', err: errDetail, code: e.status };
  }
}

function assert(desc, condition, detail = '') {
  if (condition) { passed++; console.log(`  PASS: ${desc}${detail ? ' [' + detail + ']' : ''}`); }
  else { failed++; console.log(`  FAIL: ${desc}${detail ? ' [' + detail + ']' : ''}`); }
  return condition;
}

function section(title) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(50));
}

// ========== 初始化 ==========
section('1. 初始化仓库');
// 确保目录不存在（使用 try/catch 避免锁问题）
try { fs.removeSync(TEST_DIR); } catch (e) { /* ignore */ }
fs.ensureDirSync(TEST_DIR);

const r1 = run(`${LO} init`, TEST_DIR);
assert('init 成功', r1.ok, r1.err);

// ========== 创建带标签和分类的笔记 ==========
section('2. lo new 带标签和分类');
const r2 = run(`${LO} new "测试笔记" --tags "重要,待办" --category "work"`, TEST_DIR);
assert('new 成功', r2.ok, r2.err);
assert('提示创建成功', r2.out.includes('创建成功') || r2.out.includes('笔记') || r2.out.includes('已创建'));

// 用 lo show 验证（文件名带日期前缀）
const files = fs.readdirSync(path.join(TEST_DIR, 'resources'));
const noteFile = files.find(f => f.includes('测试笔记'));
assert('找到笔记文件', !!noteFile, noteFile);
const r2b = run(`${LO} show resources/${noteFile}`, TEST_DIR);
assert('show 可查看', r2b.ok, r2b.err);
const ridMatch = r2b.out.match(/res_[a-z0-9]+_[a-f0-9]+/i);
const rid = ridMatch ? ridMatch[0] : null;
assert('可获取 RID', !!rid, rid);
assert('显示分类 work', r2b.out.includes('work'));
assert('显示标签', r2b.out.includes('重要') || r2b.out.includes('待办'));

// ========== status 应该干净 ==========
section('3. lo status (new 后应干净)');
const r3 = run(`${LO} status`, TEST_DIR);
assert('status 成功', r3.ok, r3.err);
assert('工作区干净', r3.out.includes('工作区干净'));

// ========== tag add 应暂存 ==========
section('4. lo tag add 暂存标签');
const r4 = run(`${LO} tag add ${rid} "前端"`, TEST_DIR);
assert('tag add 成功', r4.ok, r4.err);
assert('提示需 commit', r4.out.includes('需 lo commit 提交'));

// lo tag list 不应看到"前端"正式生效（只有暂存提示）
const r4b = run(`${LO} tag list ${rid}`, TEST_DIR);
assert('tag list 显示暂存提示', r4b.ok && r4b.out.includes('未提交的标签变更'));

// ========== category set 应暂存 ==========
section('5. lo category set 暂存分类');
const r5 = run(`${LO} category set ${rid} "dev"`, TEST_DIR);
assert('category set 成功', r5.ok, r5.err);
assert('提示需 commit', r5.out.includes('需 lo commit 提交'));

// ========== status 应显示元数据暂存 ==========
section('6. lo status 显示元数据暂存');
const r6 = run(`${LO} status`, TEST_DIR);
assert('status 成功', r6.ok, r6.err);
assert('显示"元数据变更"', r6.out.includes('元数据变更'));
assert('显示前端标签', r6.out.includes('前端'));
assert('显示 dev 分类', r6.out.includes('dev'));

// ========== diff 应显示元数据差异 ==========
section('7. lo diff 显示元数据差异');
const r7 = run(`${LO} diff`, TEST_DIR);
assert('diff 成功', r7.ok, r7.err);
assert('显示[元数据]', r7.out.includes('[元数据]'));

// ========== category list 暂存提示 ==========
section('8. lo category list 暂存提示');
const r8 = run(`${LO} category list ${rid}`, TEST_DIR);
assert('category list 成功', r8.ok, r8.err);
assert('显示暂存提示', r8.out.includes('未提交的分类变更'));

// ========== commit 提交元数据 ==========
section('9. lo commit 提交元数据');
const r9 = run(`${LO} commit -m "添加标签和分类"`, TEST_DIR);
assert('commit 成功', r9.ok, r9.err);
assert('显示元数据计数', r9.out.includes('元数据: 1'));

// lo tag list 提交后应看到标签
const r9b = run(`${LO} tag list ${rid}`, TEST_DIR);
assert('提交后标签可见 (前端)', r9b.out.includes('前端'));
assert('提交后标签可见 (重要)', r9b.out.includes('重要'));

// lo category list 应看到 dev
const r9c = run(`${LO} category list ${rid}`, TEST_DIR);
assert('提交后分类可见 (dev)', r9c.out.includes('dev'));

// ========== log 显示元数据计数 ==========
section('10. lo log 显示 M1');
const r10 = run(`${LO} log`, TEST_DIR);
assert('log 成功', r10.ok, r10.err);
assert('显示 M1', r10.out.includes('M1'));

// ========== status 提交后应干净 ==========
section('11. lo status 提交后应干净');
const r11 = run(`${LO} status`, TEST_DIR);
assert('status 成功', r11.ok, r11.err);
assert('工作区干净', r11.out.includes('工作区干净'));

// ========== 修改文件内容 ==========
section('12. 修改文件内容 + add + commit');
repoKey = getRepoKey();
const notePath = path.join(TEST_DIR, 'resources', noteFile);

// 解密 → 修改 → 重新加密
if (repoKey) {
  const plainBuf = decryptFile(notePath, repoKey);
  const plainText = plainBuf.toString('utf-8');
  const newPlain = Buffer.from(plainText + '\n\n新增的内容段落，用于测试修改检测。'.repeat(5), 'utf-8');
  const encrypted = encryptFile(newPlain, repoKey);
  fs.writeFileSync(notePath, encrypted);
} else {
  // 未加密的情况 — 直接修改
  const origContent = fs.readFileSync(notePath, 'utf-8');
  fs.writeFileSync(notePath, origContent + '\n\n新增的内容段落，用于测试修改检测。'.repeat(5), 'utf-8');
}

const r12 = run(`${LO} status`, TEST_DIR);
assert('status 检测到未暂存修改', r12.out.includes('未暂存的修改'));

const r12b = run(`${LO} add "resources/${noteFile}"`, TEST_DIR);
assert('add 成功', r12b.ok, r12b.err);

const r12c = run(`${LO} commit -m "修改内容"`, TEST_DIR);
assert('commit 成功', r12c.ok, r12c.err);

// 验证标签和分类在修改后仍保留
const r12d = run(`${LO} show ${rid}`, TEST_DIR);
assert('修改后标签仍保留', r12d.out.includes('重要') || r12d.out.includes('前端'));
assert('修改后分类仍保留', r12d.out.includes('dev'));

// ========== 删除测试 ==========
section('13. 删除文件 rm + commit');
const r13 = run(`${LO} new "待删除笔记"`, TEST_DIR);
assert('new 成功', r13.ok, r13.err);

// 找到 rid（文件名带日期前缀）
const files2 = fs.readdirSync(path.join(TEST_DIR, 'resources'));
const delFile = files2.find(f => f.includes('待删除笔记'));
assert('找到待删除文件', !!delFile, delFile);

const r13b = run(`${LO} show resources/${delFile}`, TEST_DIR);
const rid2Match = r13b.out.match(/res_[a-z0-9]+_[a-f0-9]+/i);
const rid2 = rid2Match ? rid2Match[0] : null;
assert('获取删除目标 RID', !!rid2, rid2);

const r13c = run(`${LO} rm "resources/${delFile}"`, TEST_DIR);
assert('rm 成功', r13c.ok, r13c.err);

const r13d = run(`${LO} commit -m "删除笔记"`, TEST_DIR);
assert('commit 删除成功', r13d.ok, r13d.err);

// 软删除验证：list 不应出现，但 show 应提示已删除
const r13e = run(`${LO} list`, TEST_DIR);
assert('list 不显示已删除资源', !r13e.out.includes('待删除笔记'));

// ========== 重命名检测 ==========
section('14. 重命名检测');
const r14 = run(`${LO} new "改名笔记"`, TEST_DIR);
assert('new 成功', r14.ok, r14.err);

const files3 = fs.readdirSync(path.join(TEST_DIR, 'resources'));
const renameFile = files3.find(f => f.includes('改名笔记') && !f.includes('已改名'));
assert('找到改名源文件', !!renameFile, renameFile);

const oldPath = path.join(TEST_DIR, 'resources', renameFile);
const newPath = path.join(TEST_DIR, 'resources', renameFile.replace('改名笔记', '已改名笔记'));
fs.moveSync(oldPath, newPath);

const r14b = run(`${LO} status`, TEST_DIR);
assert('status 成功', r14b.ok, r14b.err);
assert('显示重命名', r14b.out.includes('重命名'));

// ========== reset 测试 ==========
section('15. lo reset 清空暂存');
const r15 = run(`${LO} tag add ${rid} "reset测试"`, TEST_DIR);
assert('tag add 成功', r15.ok, r15.err);

const r15b = run(`${LO} status`, TEST_DIR);
assert('status 显示元数据变更', r15b.out.includes('元数据变更'));

const r15c = run(`${LO} reset`, TEST_DIR);
assert('reset 成功', r15c.ok, r15c.err);

const r15d = run(`${LO} status`, TEST_DIR);
assert('reset 后暂存区无元数据变更', !r15d.out.includes('元数据变更'));

// ========== 多次 tag add 累积 ==========
section('16. 多次 tag add 累积');
const r16a = run(`${LO} tag add ${rid} "A标签"`, TEST_DIR);
const r16b = run(`${LO} tag add ${rid} "B标签"`, TEST_DIR);
const r16c = run(`${LO} status`, TEST_DIR);
assert('status 显示两个新标签', 
  r16c.out.includes('A标签') && r16c.out.includes('B标签'));

const r16d = run(`${LO} commit -m "添加两个标签"`, TEST_DIR);
assert('commit 成功', r16d.ok, r16d.err);

const r16e = run(`${LO} tag list ${rid}`, TEST_DIR);
assert('提交后 A标签 可见', r16e.out.includes('A标签'));
assert('提交后 B标签 可见', r16e.out.includes('B标签'));

// ========== tag rm 工作流 ==========
section('17. lo tag rm 工作流');
const r17a = run(`${LO} tag rm ${rid} "A标签"`, TEST_DIR);
assert('tag rm 成功', r17a.ok, r17a.err);
assert('提示需 commit', r17a.out.includes('需 lo commit 提交'));

const r17b = run(`${LO} commit -m "移除标签"`, TEST_DIR);
assert('commit 成功', r17b.ok, r17b.err);

const r17c = run(`${LO} tag list ${rid}`, TEST_DIR);
assert('A标签 已移除', !r17c.out.includes('A标签'));
assert('B标签 仍保留', r17c.out.includes('B标签'));

// ========== category rm 工作流 ==========
section('18. lo category rm 工作流');
const r18a = run(`${LO} category rm ${rid}`, TEST_DIR);
assert('category rm 成功', r18a.ok, r18a.err);

const r18b = run(`${LO} commit -m "移除分类"`, TEST_DIR);
assert('commit 成功', r18b.ok, r18b.err);

const r18c = run(`${LO} category list ${rid}`, TEST_DIR);
assert('分类已移除（显示未设置）', r18c.out.includes('(未设置)'));
assert('不显示 dev', !r18c.out.includes('dev'));

// ========== 总结 ==========
section('结果');
console.log(`\n  通过: ${passed}  失败: ${failed}`);
console.log(`  总计: ${passed + failed}\n`);

// 清理
try { fs.removeSync(TEST_DIR); } catch (e) { /* ignore */ }

process.exit(failed > 0 ? 1 : 0);
