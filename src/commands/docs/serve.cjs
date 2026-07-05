const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  lo serve — 本地 HTTP API 服务'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo serve 在当前仓库启动一个本地 HTTP 服务器，对外提供 REST API。
  这是连接 lo 内部能力与外部世界（Telegram Bot、快捷指令、网页面板、
  手机 App 等任何 HTTP 客户端）的桥梁。`);

    console.log(chalk.bold.yellow('\n  为什么需要 lo serve'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  当前的 lo 是纯 CLI 工具——所有操作通过敲命令完成。
  但很多场景需要从 lo 的外部触发操作：

      "我在 Telegram 上收到一段文字，想直接存到 lo 里。"
      "我在手机上拍了张照片，想它自动进入 lo 仓库。"
      "我想从浏览器里搜索和浏览我的笔记。"

  lo serve 就是做这件事的：启动一个本地 HTTP 服务，
  把 lo 的内部能力（创建笔记、搜索、同步等）暴露为标准的 REST API。
  之后任何能发 HTTP 请求的程序（Telegram Bot、iOS 快捷指令、
  Chrome 插件、Python 脚本）都能存取 lo。`);

    console.log(chalk.bold.yellow('\n  架构'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
    ┌─────────────────────────────────────────────────────────┐
    │                    你的电脑                              │
    │                                                         │
    │   外部世界                    内部 (127.0.0.1)            │
    │  ┌──────────┐   HTTP    ┌──────────────┐               │
    │  │Telegram  │ ────────► │              │               │
    │  │Bot (VPS) │           │  lo serve    │   Repository  │
    │  ├──────────┤           │  :8765       │   API          │
    │  │快捷指令   │ ────────► │              │   ↓           │
    │  │(iOS)     │           │  SSH 认证    │  SQLite       │
    │  ├──────────┤           │  + 写锁排队   │  + 加密文件    │
    │  │Chrome    │ ────────► │              │               │
    │  │插件      │           └──────────────┘               │
    │  └──────────┘                                         │
    └─────────────────────────────────────────────────────────┘

  关键设计：
  - 只监听 127.0.0.1，不暴露到公网
  - 不会自动转发端口，外部程序需要你配置代理或公网转发
  - Telegram Bot 之类的运行在 VPS 上，需要自己组网（frp/WireGuard）
  - lo 本身只管本地，不管网络拓扑`);

    console.log(chalk.bold.yellow('\n  安全设计'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  两层安全：

  ┌──────────────────────────────────────────────────────────┐
  │  层面          │  措施              │  防什么              │
  ├──────────────────────────────────────────────────────────┤
  │  网络层        │  只监听 127.0.0.1  │  外部网络攻击        │
  │  应用层        │  SSH 挑战-应答认证  │  本机恶意程序偷调    │
  └──────────────────────────────────────────────────────────┘

  认证机制（SSH 挑战-应答）：

    lo serve 使用与 lo auth 同一套 SSH 密钥进行 API 认证。
    不再需要手动管理 Bearer Token——谁能连上取决于谁持有已注册的 SSH 私钥。

    认证流程：

      1. 客户端请求挑战 → POST /api/auth/challenge → 获得随机 nonce
      2. 客户端用本地 SSH 私钥签名 nonce（ssh-keygen -Y sign）
      3. 客户端提交签名   → POST /api/auth/login → 获得 session token
      4. 后续所有 API 请求携带 Authorization: Bearer <session-token>

    session 有效期 60 分钟，超时后需重新登录。nonce 一次性使用，防重放。

    如果仓库未注册任何 SSH 公钥：
      - API 无需认证，任何本机程序均可调用（等同于旧版本的 --no-token）
      - 建议运行 lo auth add 注册密钥启用保护

  与 lo auth 的关系：

    lo serve 的 API 认证直接复用 lo auth 注册的 SSH 公钥。
    执行 lo auth add 之后，同一把 SSH 密钥既用于：
      (a) 解锁仓库加密文件（repo.open 时一次性）
      (b) 签发 API 的 session token（每次登录时）
    不再需要单独管理 Token——SSH 密钥就是唯一的身份凭证。`);

    console.log(chalk.bold.yellow('\n  API 端点完整列表'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
    所有请求以 JSON 格式交互。Content-Type: application/json。

    ┌────────┬──────────────────────┬──────────────────────────────┐
    │  方法   │  路径                │  说明                        │
    ├────────┼──────────────────────┼──────────────────────────────┤
    │  POST  │  /api/auth/challenge │  请求 SSH 认证挑战 nonce     │
    │  POST  │  /api/auth/login     │  提交签名，获取 session token │
    ├────────┼──────────────────────┼──────────────────────────────┤
    │  GET   │  /api/health         │  健康检查 + 仓库统计          │
    │  GET   │  /api/notes          │  资源列表                     │
    │        │                      │  ?type=note&limit=20&offset=0 │
    │  GET   │  /api/notes/:rid     │  资源详情（含解密后的内容）    │
    │  POST  │  /api/notes          │  创建资源（文本内容）          │
    │        │                      │  {title, content, type, tags, category} │
    │  POST  │  /api/notes/upload   │  上传文件（multipart）         │
    │        │                      │  file + title + tags 字段     │
    │  PUT   │  /api/notes/:rid     │  更新资源                     │
    │        │                      │  {content, title, tags, category}      │
    │  DELETE│  /api/notes/:rid     │  删除（?hard=true 硬删除）     │
    │  GET   │  /api/search         │  搜索 ?q=关键词               │
    │  GET   │  /api/tags           │  所有标签列表                  │
    │  GET   │  /api/stats          │  仓库统计数据                  │
    │  POST  │  /api/sync           │  本地同步 ?full=true          │
    │  POST  │  /api/sync/push      │  推送到远程 {remote}          │
    │  POST  │  /api/sync/pull      │  从远程拉取 {remote}          │
    └────────┴──────────────────────┴──────────────────────────────┘

    认证请求示例（SSH 挑战-应答）：

      # 步骤一：获取挑战
      curl -X POST http://127.0.0.1:8765/api/auth/challenge
      → {"nonce":"abc123...","namespace":"lo-cli","registeredKeys":[...]}

      # 步骤二：用 SSH 私钥签名
      echo -n "<nonce>" > /tmp/challenge.txt
      ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n lo-cli /tmp/challenge.txt
      # 生成 /tmp/challenge.txt.sig

      # 步骤三：提交签名获取 token
      curl -X POST http://127.0.0.1:8765/api/auth/login \\
           -H "Content-Type: application/json" \\
           -d '{"nonce":"<nonce>","fingerprint":"SHA256:xxx","signature":"<base64-of-sig>"}'
      → {"token":"<session-token>","label":"我的电脑"}

    业务请求示例（curl）：

      # 健康检查
      curl -H "Authorization: Bearer <session-token>" \\
           http://127.0.0.1:8765/api/health

      # 创建笔记
      curl -X POST \\
           -H "Authorization: Bearer <session-token>" \\
           -H "Content-Type: application/json" \\
           -d '{"title":"新笔记","content":"内容...","tags":["test"],"category":"编程"}' \\
           http://127.0.0.1:8765/api/notes

      # 上传文件
      curl -X POST \\
           -H "Authorization: Bearer <session-token>" \\
           -F "file=@/path/to/photo.jpg" \\
           -F "title=我的照片" \\
           -F "tags=photo,trip" \\
           http://127.0.0.1:8765/api/notes/upload

      # 搜索
      curl -H "Authorization: Bearer <session-token>" \\
           "http://127.0.0.1:8765/api/search?q=关键词"

      # 获取笔记内容（含解密后的文本）
      curl -H "Authorization: Bearer <session-token>" \\
           "http://127.0.0.1:8765/api/notes/res_xxxx"

      # 更新笔记
      curl -X PUT \\
           -H "Authorization: Bearer <session-token>" \\
           -H "Content-Type: application/json" \\
           -d '{"content":"新内容"}' \\
           http://127.0.0.1:8765/api/notes/res_xxxx`);

    console.log(chalk.bold.yellow('\n  并发与写锁'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  SQLite 不支持高并发写入。lo serve 通过 Promise 链实现写锁排队：

    Request A (创建笔记) ──┐
    Request B (更新笔记) ──┤ 依次排队执行
    Request C (删除笔记) ──┘
    Request D (查询列表) ───── 读取不排队，并行执行

  读操作（GET）无锁，写操作（POST/PUT/DELETE）自动排队。
  对于本机单用户的场景，这完全够用。如果需要高并发，
  建议用 lo CLI 而不是 lo serve。`);

    console.log(chalk.bold.yellow('\n  集成场景'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo serve 是基础设施，之上的渠道适配器作为独立进程/程序运行：

    ┌──────────────────┐
    │  lo serve (:8765) │  ← lo 核心，只管理这一个进程
    └────────┬─────────┘
             │  HTTP
    ┌────────┼──────────────────────────────────┐
    │        │          外部适配器（独立项目）     │
    │        ▼                                  │
    │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
    │  │Telegram  │  │iOS 快捷   │  │Web      │ │
    │  │Bot       │  │指令      │  │Dashboard│ │
    │  └──────────┘  └──────────┘  └─────────┘ │
    └───────────────────────────────────────────┘

  这些适配器不是 lo 的一部分，是独立程序。
  lo 不需要知道 Telegram 是什么——lo 只负责提供 HTTP API。
  适配器只负责把"Telegram 消息"翻译成"HTTP 请求发给 lo"。

  要添加新渠道？写一个 HTTP 客户端即可。lo 本体无需任何修改。`);

    console.log(chalk.bold.yellow('\n  使用流程'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  # 启动服务
  lo serve                           # 默认 8765 端口
  lo serve --port 9000               # 自定义端口
  lo serve -p 8888 -r ~/notes        # 完整参数

  # 如仓库已注册 SSH 公钥，客户端需先登录：
  #   1. POST /api/auth/challenge    获取 nonce
  #   2. ssh-keygen -Y sign          签名 nonce
  #   3. POST /api/auth/login        获取 session token

  # 终端测试（先获取 token 后）
  curl -H "Authorization: Bearer <token>" http://127.0.0.1:8765/api/health

  # 如果仓库加密，启动时完成一次性 SSH 认证即可
  # 运行期间（直到按 Ctrl+C）不会重复认证

  注意事项：
  - 不要改为 0.0.0.0 监听——那样会暴露到局域网/公网
  - 如果确实需要远程访问，用 frp/WireGuard/Tailscale 做端口转发
  - 服务停止后所有 HTTP 端点不可用，需重新启动
  - session token 有效期 60 分钟，过期后需重新登录
  - 未注册 SSH 公钥的仓库不强制认证（建议执行 lo auth add）`);
};
