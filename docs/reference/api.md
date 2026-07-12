## HTTP API 参考

`lo serve` 在当前仓库启动一个本地 HTTP 服务器，对外提供 REST API。这是连接 lo 内部能力与外部世界的桥梁。

### 启动服务

```bash
lo serve                    # 默认 8765 端口
lo serve --port 9000        # 自定义端口
lo serve -p 8888 -r ~/notes # 完整参数
```

> 只监听 127.0.0.1，不暴露到公网。如需远程访问，使用 frp/WireGuard/Tailscale 做端口转发。

### 认证机制

lo serve 使用 SSH 挑战-应答认证（复用 `lo auth` 注册的 SSH 公钥）：

1. `POST /api/auth/challenge` — 获取随机 nonce
2. `ssh-keygen -Y sign` — 用本地 SSH 私钥签名 nonce
3. `POST /api/auth/login` — 提交签名，获取 session token
4. 后续请求携带 `Authorization: Bearer <session-token>`

session 有效期 60 分钟。未注册 SSH 公钥的仓库不强制认证。

### API 端点列表

所有请求以 JSON 格式交互，`Content-Type: application/json`。

#### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/challenge` | 请求 SSH 认证挑战 nonce |
| POST | `/api/auth/login` | 提交签名，获取 session token |

**认证示例：**

```bash
# 步骤一：获取挑战
curl -X POST http://127.0.0.1:8765/api/auth/challenge
# → {"nonce":"abc123...","namespace":"lo-cli","registeredKeys":[...]}

# 步骤二：用 SSH 私钥签名
echo -n "<nonce>" > /tmp/challenge.txt
ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n lo-cli /tmp/challenge.txt

# 步骤三：提交签名获取 token
curl -X POST http://127.0.0.1:8765/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"nonce":"<nonce>","fingerprint":"SHA256:xxx","signature":"<base64-of-sig>"}'
# → {"token":"<session-token>","label":"我的电脑"}
```

#### 健康与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 + 仓库统计 |

```bash
curl -H "Authorization: Bearer <token>" http://127.0.0.1:8765/api/health
```

#### 资源 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notes` | 资源列表，支持 `?type=note&limit=20&offset=0` |
| GET | `/api/notes/:rid` | 资源详情（含解密后的内容）|
| POST | `/api/notes` | 创建资源（文本内容）|
| POST | `/api/notes/upload` | 上传文件（multipart）|
| PUT | `/api/notes/:rid` | 更新资源 |
| DELETE | `/api/notes/:rid` | 删除（`?hard=true` 硬删除）|

**创建笔记：**

```bash
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"title":"新笔记","content":"内容...","tags":["test"],"category":"编程/Python/爬虫"}' \
     http://127.0.0.1:8765/api/notes
```

**上传文件：**

```bash
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -F "file=@/path/to/photo.jpg" \
     -F "title=我的照片" \
     -F "tags=photo,trip" \
     http://127.0.0.1:8765/api/notes/upload
```

**获取笔记内容：**

```bash
curl -H "Authorization: Bearer <token>" \
     "http://127.0.0.1:8765/api/notes/res_xxxx"
```

**更新笔记：**

```bash
curl -X PUT \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"content":"新内容","title":"新标题","tags":["更新"],"category":"编程"}' \
     http://127.0.0.1:8765/api/notes/res_xxxx
```

#### 搜索

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/search` | 搜索 `?q=关键词` |

```bash
curl -H "Authorization: Bearer <token>" \
     "http://127.0.0.1:8765/api/search?q=关键词"
```

#### 标签与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tags` | 所有标签列表 |
| GET | `/api/stats` | 仓库统计数据 |

#### 同步

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sync` | 本地同步 `?full=true` 全量 |
| POST | `/api/sync/push` | 推送到远程 `{"remote":"..."}` |
| POST | `/api/sync/pull` | 从远程拉取 `{"remote":"..."}` |

```bash
# 本地同步
curl -X POST -H "Authorization: Bearer <token>" \
     http://127.0.0.1:8765/api/sync

# 推送到远程
curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"remote":"myserver"}' \
     http://127.0.0.1:8765/api/sync/push

# 从远程拉取
curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"remote":"myserver"}' \
     http://127.0.0.1:8765/api/sync/pull
```

---

### 并发与写锁

SQLite 不支持高并发写入。lo serve 通过写锁排队处理：

- 读操作（GET）无锁，并行执行
- 写操作（POST/PUT/DELETE）自动排队依次执行

### 集成架构

```
lo serve (:8765)  ← lo 核心
    │  HTTP
    ▼
外部适配器（独立项目）:
├── Telegram Bot      ← 将消息翻译为 HTTP 请求
├── iOS 快捷指令       ← 通过捷径调用 API
├── Web Dashboard     ← 浏览器管理面板
└── 自定义脚本        ← Python/Bash 自动化
```

### 注意事项

- 不要改为 `0.0.0.0` 监听——那样会暴露到局域网/公网
- 服务停止后所有 HTTP 端点不可用
- session token 有效期 60 分钟
- 未注册 SSH 公钥的仓库不强制认证（建议执行 `lo auth add`）

### 相关命令

- `lo serve` — 启动服务
- `lo auth add` — 注册 SSH 公钥
- `lo manual serve` — 查看完整手册

### 相关文档

- [SSH 身份认证](../core/auth.md) — 认证机制详解
- [远程同步](../core/sync.md) — 同步 API 使用
- [架构分析](../advanced/architecture.md) — 模块 HTTP 路由注册
