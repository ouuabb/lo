const http = require('http');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const os = require('os');
const Repository = require('../repo/repository.cjs');
const CryptoUtils = require('../utils/crypto.cjs');
const SshAuth = require('../utils/sshAuth.cjs');
const SyncRemote = require('../utils/syncRemote.cjs');
const { resolveRemote } = require('./remote.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function methodNotAllowed(res) {
  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}

function notFound(res, message = 'Not found') {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

function badRequest(res, message) {
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

function serverError(res, message) {
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

function jsonOk(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * 读取 body（用于 JSON 解析）
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 解析 URL 路径中的 rid
 */
function extractRid(urlPath) {
  const match = urlPath.match(/^\/api\/notes\/(res_[a-zA-Z0-9_]+)/);
  return match ? match[1] : null;
}

/**
 * 读取资源文件内容（自动解密）
 */
async function readResourceContent(filePath, cryptoKey) {
  const raw = await fs.readFile(filePath);

  if (raw.length >= 4 && raw.subarray(0, 4).equals(CryptoUtils.MAGIC)) {
    if (!cryptoKey) {
      throw new Error('文件已加密但无法获取解密密钥');
    }
    return CryptoUtils.decryptFile(raw, cryptoKey).toString('utf-8');
  }

  return raw.toString('utf-8');
}

// ---------------------------------------------------------------------------
// Multipart 解析（文件上传）
// ---------------------------------------------------------------------------

/**
 * 解析 multipart/form-data 请求体
 * @param {Buffer} body - 原始请求体
 * @param {string} boundary - 分界符（不含开头的 --）
 * @returns {{fields: Object<string,string>, files: Array<{name:string, filename:string, contentType:string, data:Buffer}>}}
 */
function parseMultipart(body, boundary) {
  const fields = {};
  const files = [];
  const fullBoundary = Buffer.from('--' + boundary);

  let pos = body.indexOf(fullBoundary);
  while (pos !== -1) {
    // 跳过 boundary 和 \r\n
    let start = pos + fullBoundary.length;
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

    // 找到下一个 boundary
    const nextBoundary = body.indexOf(fullBoundary, start);
    if (nextBoundary === -1) break;

    // 提取当前 part（去掉末尾 \r\n）
    let partEnd = nextBoundary - 2;
    if (body[partEnd] === 0x0d && body[partEnd + 1] === 0x0a) {
      // ok
    } else {
      partEnd = nextBoundary;
    }
    const part = body.slice(start, partEnd);

    // 分割 headers 和 body
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) { pos = nextBoundary; continue; }

    const headerText = part.slice(0, headerEnd).toString('utf-8');
    const data = part.slice(headerEnd + 4);

    // 解析 Content-Disposition
    const nameMatch = headerText.match(/name="([^"]+)"/);
    if (!nameMatch) { pos = nextBoundary; continue; }
    const name = nameMatch[1];

    const filenameMatch = headerText.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);

    if (filenameMatch) {
      files.push({
        name,
        filename: decodeURIComponent(filenameMatch[1]),
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
        data
      });
    } else {
      fields[name] = data.toString('utf-8');
    }

    pos = nextBoundary;
  }

  return { fields, files };
}

// ---------------------------------------------------------------------------
// SSH 挑战-应答认证（API 层）
// ---------------------------------------------------------------------------

/**
 * 验证 SSH 签名
 * @param {string} nonce - 挑战随机数
 * @param {string} publicKey - 注册的公钥（OpenSSH 格式）
 * @param {string} signatureBase64 - 客户端发来的签名（.sig 文件的 base64）
 * @returns {boolean}
 */
function verifySshSignature(nonce, publicKey, signatureBase64) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-api-auth-'));
  try {
    const challengeFile = path.join(workDir, 'challenge.txt');
    const sigFile = path.join(workDir, 'challenge.txt.sig');
    const allowedSignersFile = path.join(workDir, 'allowed_signers');

    fs.writeFileSync(challengeFile, nonce);
    fs.writeFileSync(sigFile, Buffer.from(signatureBase64, 'base64'));

    const pubParts = publicKey.split(/\s+/);
    if (pubParts.length < 2) return false;
    const signersContent = `* ${pubParts[0]} ${pubParts[1]} ${pubParts.slice(2).join(' ') || ''}`;
    fs.writeFileSync(allowedSignersFile, signersContent);

    execFileSync('ssh-keygen', [
      '-Y', 'verify', '-f', allowedSignersFile,
      '-n', 'lo-cli', '-s', sigFile
    ], { stdio: 'pipe', windowsHide: true, timeout: 15000, input: nonce });

    return true;
  } catch {
    return false;
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

// ---------------------------------------------------------------------------
// 会话管理
// ---------------------------------------------------------------------------

/**
 * @type {Map<string, {fingerprint: string, label: string, expiresAt: number}>}
 */
const sessions = new Map();

/**
 * @type {Map<string, {timestamp: number}>}
 */
const pendingChallenges = new Map();

const SESSION_TTL_MS = 60 * 60 * 1000;    // session 有效期 60 分钟
const CHALLENGE_TTL_MS = 5 * 60 * 1000;    // 挑战有效期 5 分钟

function createSession(fingerprint, label) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    fingerprint,
    label,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(token);
  }
  for (const [nonce, challenge] of pendingChallenges) {
    if (now - challenge.timestamp > CHALLENGE_TTL_MS) pendingChallenges.delete(nonce);
  }
}

// 每 5 分钟清理过期数据
setInterval(cleanupExpired, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// 路由表
// ---------------------------------------------------------------------------

const GET_ROUTES = new Map();
const POST_ROUTES = new Map();
const PUT_ROUTES = new Map();
const DELETE_ROUTES = new Map();

function route(method, pattern, handler) {
  const map = { GET: GET_ROUTES, POST: POST_ROUTES, PUT: PUT_ROUTES, DELETE: DELETE_ROUTES }[method];
  map.set(pattern, handler);
}

// ---- SSH 认证端点 ------------------------------------------------

route('POST', '/api/auth/challenge', async (req, res, { authState, reloadKeys }) => {
  await reloadKeys();
  if (!authState.needAuth) {
    return badRequest(res, '仓库未注册任何 SSH 公钥，无需认证');
  }
  const nonce = crypto.randomBytes(32).toString('hex');
  pendingChallenges.set(nonce, { timestamp: Date.now() });

  jsonOk(res, {
    nonce,
    namespace: 'lo-cli',
    registeredKeys: authState.registeredKeys.map(k => ({
      fingerprint: k.fingerprint,
      label: k.label,
      keyType: k.keyType
    }))
  });
});

route('POST', '/api/auth/reload', async (req, res, { authState, reloadKeys }) => {
  await reloadKeys();
  jsonOk(res, {
    message: '密钥列表已刷新',
    count: authState.registeredKeys.length,
    keys: authState.registeredKeys.map(k => ({ fingerprint: k.fingerprint, label: k.label }))
  });
});

route('POST', '/api/auth/login', async (req, res, { authState }) => {
  if (!authState.registeredKeys || authState.registeredKeys.length === 0) {
    return badRequest(res, '仓库未注册任何 SSH 公钥，无需认证');
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return badRequest(res, e.message);
  }

  const { nonce, fingerprint, signature } = body;
  if (!nonce || !fingerprint || !signature) {
    return badRequest(res, '缺少 nonce、fingerprint 或 signature 字段');
  }

  // 验证 nonce 有效（防重放）
  const challenge = pendingChallenges.get(nonce);
  if (!challenge) {
    return badRequest(res, '无效或已过期的 nonce，请重新获取挑战');
  }
  pendingChallenges.delete(nonce);

  // 找到对应的注册公钥
  const registeredKey = authState.registeredKeys.find(k => k.fingerprint === fingerprint);
  if (!registeredKey) {
    return badRequest(res, '未注册的 SSH 指纹');
  }

  // 验证签名
  if (!verifySshSignature(nonce, registeredKey.publicKey, signature)) {
    return jsonOk(res, { error: 'SSH 签名验证失败' }, 401);
  }

  // 签发 session token
  const token = createSession(fingerprint, registeredKey.label);
  jsonOk(res, { token, label: registeredKey.label, fingerprint });
});

// ---- 业务端点 ------------------------------------------------

route('GET', '/api/health', async (req, res, { repo }) => {
  const stats = await repo.getStats();
  jsonOk(res, { status: 'ok', uptime: process.uptime(), stats });
});

route('GET', '/api/stats', async (req, res, { repo }) => {
  const stats = await repo.getStats();
  jsonOk(res, stats);
});

route('GET', '/api/tags', async (req, res, { repo }) => {
  const resources = await repo.getAllResources();
  const tags = new Set();
  for (const r of resources) {
    const md = r.metadata || {};
    if (Array.isArray(md.tags)) {
      md.tags.forEach((t) => tags.add(t));
    }
  }
  jsonOk(res, { tags: [...tags].sort() });
});

route('GET', '/api/notes', async (req, res, { repo, url }) => {
  const type = url.searchParams.get('type') || null;
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const resources = await repo.getAllResources({ type, limit, offset });
  jsonOk(res, { total: resources.length, limit, offset, data: resources });
});

route('GET', '/api/notes/:rid', async (req, res, { repo, url }) => {
  const rid = extractRid(url.pathname);
  if (!rid) return notFound(res, 'Invalid rid');

  const resource = await repo.getResource(rid);
  if (!resource) return notFound(res, 'Resource not found');
  if (resource.deleted) return notFound(res, 'Resource has been deleted');

  try {
    const content = await readResourceContent(resource.path, repo.cryptoKey);
    jsonOk(res, { ...resource, content });
  } catch (e) {
    serverError(res, `Failed to read file: ${e.message}`);
  }
});

route('GET', '/api/search', async (req, res, { repo, url }) => {
  const q = url.searchParams.get('q');
  if (!q) return badRequest(res, 'Missing query parameter "q"');
  const results = await repo.search(q);
  jsonOk(res, { query: q, total: results.length, data: results });
});

route('POST', '/api/notes/upload', async (req, res, { repo }) => {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return badRequest(res, '需要 multipart/form-data 请求');
  }
  const boundary = boundaryMatch[1].replace(/^["']|["']$/g, '');

  // 读取完整 body
  const chunks = [];
  try {
    await new Promise((resolve, reject) => {
      req.on('data', (c) => chunks.push(c));
      req.on('end', resolve);
      req.on('error', reject);
    });
  } catch (e) {
    return badRequest(res, '读取文件失败');
  }

  const body = Buffer.concat(chunks);
  const { fields, files } = parseMultipart(body, boundary);

  if (files.length === 0) {
    return badRequest(res, '未找到上传的文件（field name 需为 "file"）');
  }

  const results = [];
  for (const file of files) {
    const title = fields.title || file.filename;
    let tags = [];
    if (fields.tags) {
      tags = fields.tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    // 推断资源类型
    let type = 'file';
    if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(file.filename)) type = 'image';
    else if (/\.(mp4|mov|avi|mkv|webm)$/i.test(file.filename)) type = 'video';
    else if (/\.(mp3|wav|ogg|flac|aac)$/i.test(file.filename)) type = 'audio';
    else if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i.test(file.filename)) type = 'document';

    try {
      const result = await repo.createResource(type, file.data, {
        filename: file.filename,
        metadata: {
          title,
          tags,
          mimetype: file.contentType,
          size: file.data.length
        }
      });
      results.push(result);
    } catch (e) {
      return serverError(res, `保存文件失败: ${e.message}`);
    }
  }

  jsonOk(res, {
    uploaded: results.length,
    data: results
  }, 201);
});

route('POST', '/api/notes', async (req, res, { repo }) => {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return badRequest(res, e.message);
  }

  const { type = 'note', content, metadata = {}, filename } = body;
  if (!content && !body.title) return badRequest(res, 'Missing "content" or "title" field');

  const actualContent = content || body.title || '';
  const mergedMetadata = { ...metadata };
  if (body.title && !mergedMetadata.title) mergedMetadata.title = body.title;
  if (body.tags && !mergedMetadata.tags) mergedMetadata.tags = body.tags;
  if (body.category && !mergedMetadata.category) mergedMetadata.category = body.category;

  try {
    const result = await repo.createResource(type, actualContent, {
      filename,
      metadata: mergedMetadata
    });
    jsonOk(res, result, 201);
  } catch (e) {
    serverError(res, e.message);
  }
});

route('PUT', '/api/notes/:rid', async (req, res, { repo, url }) => {
  const rid = extractRid(url.pathname);
  if (!rid) return notFound(res, 'Invalid rid');

  const resource = await repo.getResource(rid);
  if (!resource) return notFound(res, 'Resource not found');
  if (resource.deleted) return notFound(res, 'Resource has been deleted');

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return badRequest(res, e.message);
  }

  const updates = {};
  const { content } = body;

  try {
    if (content !== undefined) {
      const filePath = path.resolve(resource.path);
      const rawContent = typeof content === 'string' ? content : JSON.stringify(content);

      if (repo.cryptoKey) {
        const encrypted = CryptoUtils.encryptFile(Buffer.from(rawContent, 'utf-8'), repo.cryptoKey);
        await fs.writeFile(filePath, encrypted);
      } else {
        await fs.writeFile(filePath, rawContent, 'utf-8');
      }

      // 使用 refresh() 统一提取标题、词数、hash（自动处理加密/明文）
      const refreshed = await repo.resourceService.refresh(rid);
      updates.hash = refreshed.hash;
      if (!body.metadata && !body.title) {
        // 未显式传 metadata 时，使用 refresh 提取的结果
        updates.metadata = refreshed.metadata;
      }
    }

    // 用户显式传入的 metadata/title/tags/category 覆盖 refresh 结果
    if (body.metadata !== undefined) {
      updates.metadata = { ...(updates.metadata || resource.metadata || {}), ...body.metadata };
    }
    if (body.title !== undefined) {
      updates.metadata = { ...(updates.metadata || resource.metadata || {}), title: body.title };
    }
    if (body.tags !== undefined) {
      updates.metadata = { ...(updates.metadata || resource.metadata || {}), tags: body.tags };
    }
    if (body.category !== undefined) {
      updates.metadata = { ...(updates.metadata || resource.metadata || {}), category: body.category };
    }

    if (Object.keys(updates).length > 0) {
      const result = await repo.updateResource(rid, updates);
      jsonOk(res, result);
    } else {
      jsonOk(res, resource);
    }
  } catch (e) {
    serverError(res, e.message);
  }
});

route('DELETE', '/api/notes/:rid', async (req, res, { repo, url }) => {
  const rid = extractRid(url.pathname);
  if (!rid) return notFound(res, 'Invalid rid');

  const hard = url.searchParams.get('hard') === 'true';
  try {
    const result = await repo.deleteResource(rid, !hard);
    jsonOk(res, result);
  } catch (e) {
    serverError(res, e.message);
  }
});

route('POST', '/api/sync', async (req, res, { repo, url }) => {
  const full = url.searchParams.get('full') === 'true';
  try {
    const result = await repo.sync({ full });
    jsonOk(res, result);
  } catch (e) {
    serverError(res, e.message);
  }
});

route('POST', '/api/sync/push', async (req, res, { repo }) => {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return badRequest(res, e.message);
  }

  const { remote } = body;
  if (!remote) return badRequest(res, 'Missing "remote" field');

  try {
    const target = resolveRemote(repo, remote) || remote;
    const syncRemote = new SyncRemote(repo.repoPath);
    const syncOps = repo.syncOps;

    const ops = await syncOps.getUnsyncedOps(target);
    if (!ops || ops.length === 0) {
      return jsonOk(res, { pushed: 0, message: '没有需要推送的变更' });
    }

    const batchId = await syncRemote.pushBatch(target, ops);
    await syncOps.markSynced(ops, target);
    jsonOk(res, { pushed: ops.length, batchId });
  } catch (e) {
    serverError(res, e.message);
  }
});

route('POST', '/api/sync/pull', async (req, res, { repo }) => {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return badRequest(res, e.message);
  }

  const { remote } = body;
  if (!remote) return badRequest(res, 'Missing "remote" field');

  try {
    const target = resolveRemote(repo, remote) || remote;
    const syncRemote = new SyncRemote(repo.repoPath);
    const result = await syncRemote.pullLatestBatch(target);
    if (!result) {
      return jsonOk(res, { pulled: 0, message: '没有新的批次' });
    }

    const { manifest, ops } = result;
    const syncOps = repo.syncOps;
    const applied = await syncOps.applyOps(ops, manifest.device_id);

    await syncRemote.installResources(result.extractDir, repo.repoPath);

    const latestOp = ops.reduce((max, op) => op.timestamp > max.timestamp ? op : max, ops[0]);
    await syncOps.setSyncAnchor(target, { last_op_id: latestOp.op_id, last_op_timestamp: latestOp.timestamp });

    await repo.sync({ silent: true });

    jsonOk(res, { pulled: applied, opsInBatch: ops.length });
  } catch (e) {
    serverError(res, e.message);
  }
});

// ---------------------------------------------------------------------------
// 路由匹配
// ---------------------------------------------------------------------------

function matchRoute(method, pathname) {
  const map = { GET: GET_ROUTES, POST: POST_ROUTES, PUT: PUT_ROUTES, DELETE: DELETE_ROUTES }[method];
  if (!map) return null;

  if (map.has(pathname)) return map.get(pathname);

  if (pathname.startsWith('/api/notes/') && pathname.split('/').length === 4) {
    const exactKey = '/api/notes/:rid';
    if (map.has(exactKey)) return map.get(exactKey);
  }

  return null;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

module.exports = async function serve(argv) {
  const repoPath = path.resolve(argv.repo || process.cwd());
  const port = parseInt(argv.port) || 8765;
  const host = '127.0.0.1';

  // 打开仓库
  const repo = new Repository(repoPath);

  try {
    await repo.open();
  } catch (e) {
    console.error(chalk.red(`无法打开仓库: ${e.message}`));
    process.exit(1);
  }

  // 读取已注册的 SSH 公钥（启动时加载，支持热更新）
  const authState = { needAuth: false, registeredKeys: [] };

  async function reloadKeys() {
    try {
      const keysJson = await repo.getConfig('auth.ssh.keys');
      if (keysJson) {
        authState.registeredKeys = JSON.parse(keysJson);
        authState.needAuth = authState.registeredKeys.length > 0;
      } else {
        authState.registeredKeys = [];
        authState.needAuth = false;
      }
    } catch {
      authState.registeredKeys = [];
      authState.needAuth = false;
    }
  }

  await reloadKeys();

  // 写锁（按顺序排队写操作）
  let writeChain = Promise.resolve();

  function withWriteLock(fn) {
    const result = writeChain.then(fn, fn);
    writeChain = result.catch(() => {});
    return result;
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const method = req.method.toUpperCase();
    const pathname = url.pathname;

    // CORS（宽松，只监听 127.0.0.1）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 鉴权：/api/auth/* 不需要认证，其余接口需要
    const isAuthEndpoint = pathname === '/api/auth/challenge' || pathname === '/api/auth/login' || pathname === '/api/auth/reload';

    if (authState.needAuth && !isAuthEndpoint) {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const session = validateSession(token);

      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Unauthorized',
          hint: '请先通过 SSH 认证: POST /api/auth/challenge → POST /api/auth/login'
        }));
        return;
      }
    }

    const handler = matchRoute(method, pathname);
    if (!handler) {
      return notFound(res, `No route for ${method} ${pathname}`);
    }

    const ctx = { repo, url, authState, reloadKeys };

    if (['POST', 'PUT', 'DELETE'].includes(method) && !isAuthEndpoint) {
      withWriteLock(() => handler(req, res, ctx));
    } else {
      handler(req, res, ctx).catch((e) => {
        if (!res.headersSent) serverError(res, e.message);
      });
    }
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(chalk.red(`端口 ${port} 已被占用`));
      process.exit(1);
    } else {
      console.error(chalk.red(`服务器错误: ${e.message}`));
      process.exit(1);
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));

  // 启动信息
  console.log(chalk.green(`\n  lo serve 已启动`));
  console.log(chalk.gray(`  地址: http://${host}:${port}`));
  console.log(chalk.gray(`  仓库: ${repoPath}`));

  if (authState.needAuth) {
    console.log(chalk.gray(`  认证: SSH 挑战-应答（${authState.registeredKeys.length} 把已注册密钥）`));
    if (SshAuth.supportsYSign()) {
      console.log(chalk.gray(`  签名: ssh-keygen -Y sign (OpenSSH)`));
    }
  } else {
    console.log(chalk.yellow(`  认证: 未启用（仓库未注册 SSH 公钥）`));
    console.log(chalk.gray(`  任何本机程序均可调用 API，建议运行 lo auth add 注册密钥`));
  }

  console.log(chalk.gray(`  按 Ctrl+C 停止`));
  console.log('');

  // 优雅关闭
  const shutdown = async () => {
    console.log(chalk.gray('\n  正在关闭...'));
    server.close();
    await repo.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};
