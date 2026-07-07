const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  仓库部署与远程推送'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    // ============================================================
    // 一、概述
    // ============================================================
    console.log(chalk.bold.yellow('\n  一、部署是什么意思'));
    console.log(`
  lo 是本地优先的工具，没有"云端服务"的概念。所谓的"部署"，
  就是在你能通过 SSH 访问的任意机器上创建一个目录，作为同步中继。

  ┌─────────────────────────────────────────────────────────────┐
  │                                                              │
  │   lo 的"远程" ≠ 传统意义上的"服务器"                          │
  │                                                              │
  │   远程只是一个目录，不运行任何 lo 进程，不需要数据库，        │
  │   不需要安装任何依赖。它的唯一职责是：                        │
  │                                                              │
  │     存储 sync_batches/ 下的 .tar.gz 批次文件                  │
  │     允许客户端通过 SCP 上传/下载这些批次文件                   │
  │                                                              │
  │   所有逻辑（打包、校验、冲突解决、加密）都在客户端完成。      │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  这意味着你可以用任何东西当"远程"：
    - 一台云服务器（阿里云、AWS、VPS）
    - 一台家里的树莓派
    - 一台办公室的 Linux 开发机
    - 甚至一个支持 SSH 的 NAS
    - 一部 U 盘 / 移动硬盘（走本地文件复制，不需要 SSH）`);

    // ============================================================
    // 二、远程端设置
    // ============================================================
    console.log(chalk.bold.yellow('\n  二、远程端设置（服务器侧）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  前提条件：
    - 服务器运行 SSH 守护进程（sshd），几乎所有的 Linux 服务器默认开启
    - 你的客户端能用 SSH 密钥登录服务器（推荐，避免每次输密码）
    - 服务器上的目标目录存在且你有写权限

  步骤 1：在服务器上创建目录

    ssh user@your-server
    mkdir -p /data/lo-notes
    exit

  步骤 2：配置 SSH 免密登录（客户端侧，非必须但强烈推荐）

    # 生成 SSH 密钥（如果没有）
    ssh-keygen -t ed25519 -C "lo-sync"

    # 将公钥复制到服务器
    ssh-copy-id user@your-server

    # 测试免密登录
    ssh user@your-server "echo ok"
    # 应该输出 ok，不要求密码

  步骤 3：为方便使用创建 SSH 别名（可选）

    编辑 ~/.ssh/config，添加：

      Host lo-server
        HostName your-server.com
        User user
        Port 22
        IdentityFile ~/.ssh/id_ed25519

    之后可以用 lo-server 代替完整的 user@your-server.com。`);

    // ============================================================
    // 三、本地端设置
    // ============================================================
    console.log(chalk.bold.yellow('\n  三、本地端设置'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  步骤 1：初始化 lo 仓库（如果是新仓库）

    cd ~/my-notes           # 进入你打算存放笔记的目录
    lo init                 # 初始化仓库

  步骤 2：（可选）启用加密

    如果你想笔记在中继服务器上是加密的（密文），必须先设置加密：

    lo auth add -k ~/.ssh/id_ed25519 -l "我的电脑"

    这会的效果：
      - 生成一个仓库主密钥（RepoKey，AES-256）
      - 用你的 SSH 公钥保护 RepoKey
      - 之后所有笔记自动以 LOEC 加密格式存储
      - 中继服务器只能看到密文

    注意：lo auth 使用的 SSH 密钥 与 SCP 传输使用的 SSH 密钥
    是两套独立机制。前者保护笔记内容（加密层），后者保护传输通道（传输层）。
    它们可以用同一把密钥，也可以不同。

  步骤 3：注册远程地址别名（推荐）

    lo remote add myserver user@your-server:/data/lo-notes

    之后用 myserver 代替完整地址：
    lo push myserver
    lo pull myserver

    如果用了 SSH 别名：
    lo remote add myserver lo-server:/data/lo-notes

  步骤 4：首次推送（建立同步关系）

    lo new "Hello World"     # 先创建一些内容
    lo push myserver         # 首次推送，建立锚点

    首次推送后，服务器上会自动创建 sync_batches/ 目录并上传首批批次文件。`);

    // ============================================================
    // 四、推送完整流程
    // ============================================================
    console.log(chalk.bold.yellow('\n  四、推送的完整流程'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo push <remote> 执行的完整流程（从用户视角到网络传输）：

  ┌──── 阶段 1：本地扫描 ────────────────────────────────────────┐
  │                                                               │
  │  lo sync（自动触发）                                           │
  │    ├── 扫描仓库目录下所有文件                          │
  │    ├── 对比每个文件与数据库中的记录                             │
  │    ├── 检测：新增、修改、删除、重命名                           │
  │    ├── 将变更写入 sync_ops 表（操作日志）                       │
  │    └── 更新 resources 表（散列、元数据等）                      │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌──── 阶段 2：查询变更 ────────────────────────────────────────┐
  │                                                               │
  │  读取锚点（sync_config 中的 sync.anchor.<remote>）              │
  │    ├── 首次推送：锚点为空 → 发送所有本设备产生的操作             │
  │    └── 后续推送：只发送 timestamp > 锚点时间戳的操作             │
  │                                                               │
  │  过滤规则：                                                    │
  │    只查询 device_id = 本机 的操作（WHERE device_id = ?）       │
  │    这避免了"收到远程操作 → 本地重放 → 再推送出去"的死循环       │
  │                                                               │
  │  如果没有新操作 → 输出"没有变更"并退出                          │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌──── 阶段 3：打包批次 ────────────────────────────────────────┐
  │                                                               │
  │  创建 batch_<timestamp>.tar.gz，内含：                          │
  │                                                               │
  │    manifest.json         批次清单                              │
  │      {                                                        │
  │        "device_id": "uuid",                                    │
  │        "timestamp": 1749200000,                                │
  │        "op_count": 15,                                        │
  │        "last_op_id": "uuid",                                   │
  │        "last_op_timestamp": 1749200000,                        │
  │        "checksum": "sha256 of manifest itself"                 │
  │      }                                                        │
  │                                                               │
  │    ops.json              操作日志数组                          │
  │      [                                                        │
  │        {                                                      │
  │          "op_id": "...",                                       │
  │          "op_type": "resource_created",                        │
  │          "rid": "res_xxx",                                     │
  │          "data": { "path": "...", "hash": "...", ... },        │
  │          "timestamp": 1749200000,                              │
  │          "device_id": "..."                                    │
  │        },                                                      │
  │        ...                                                     │
  │      ]                                                        │
  │                                                               │
  │    checksums.json        每个文件的 SHA-256                    │
  │      {                                                        │
  │        "ops.json": "sha256...",                                │
  │        "manifest.json": "sha256...",                           │
  │        "resources/2026-07-05-note.md": "sha256...",            │
  │        ...                                                     │
  │      }                                                        │
  │                                                               │
  │    resources/            关联的资源文件                        │
  │      └── 2026-07-05-note.md      ← 加密后的文件（LOEC 格式）   │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌──── 阶段 4：上传 ────────────────────────────────────────────┐
  │                                                               │
  │  根据远程地址类型选择传输方式：                                 │
  │                                                               │
  │  SCP 远程（user@host:/path）：                                  │
  │    scp batch_xxx.tar.gz user@host:/path/sync_batches/          │
  │    底层使用系统 SSH 配置（~/.ssh/config）                       │
  │                                                               │
  │  本地路径（/mnt/usb/backup 或 D:\\backup）：                    │
  │    fs.copyFile → /mnt/usb/backup/sync_batches/batch_xxx.tar.gz │
  │    不走网络，直接文件复制                                      │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌──── 阶段 5：更新锚点 ────────────────────────────────────────┐
  │                                                               │
  │  上传成功后，更新本地锚点：                                     │
  │    sync.anchor.<remote> = {                                    │
  │      last_op_id: 批次中最后一条 op 的 id,                       │
  │      last_op_timestamp: 批次中最后一条 op 的时间戳               │
  │    }                                                          │
  │                                                               │
  │  下次 push 时将从这个锚点之后开始查询新操作。                    │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘

  完整命令示例：

    $ lo push myserver
    Syncing...
    Packaging 15 ops into batch_1749200000123.tar.gz...
    Uploading to user@server:/data/lo-notes/sync_batches/...
    ✓ Pushed 15 ops to myserver
    Batch: batch_1749200000123`);

    // ============================================================
    // 五、通过 HTTP API 推送
    // ============================================================
    console.log(chalk.bold.yellow('\n  五、通过 HTTP API 推送'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo serve 暴露了同步 API，你可以通过 HTTP 请求触发推送，
  无需手动执行 CLI 命令。这对自动化非常有价值。

  API 端点：

    POST /api/sync       本地 sync（扫描文件系统，更新 DB）
      Query: ?full=true  全量重新扫描
      Body:  无

    POST /api/sync/push  推送到远程
      Body:  {"remote": "user@server:/path"}

    POST /api/sync/pull  从远程拉取
      Body:  {"remote": "user@server:/path"}

  ┌──────────────────────────────────────────────────────────────┐
  │  完整认证 + 推送流程（curl 示例）                              │
  └──────────────────────────────────────────────────────────────┘

  # 0. 确保 lo serve 在运行
  lo serve                          # 默认 127.0.0.1:8765

  # 1. 获取认证挑战
  curl -s -X POST http://127.0.0.1:8765/api/auth/challenge
  # → {"nonce":"abc123...","namespace":"lo-cli","registeredKeys":[...]}

  # 2. 用 SSH 私钥签名 nonce
  echo -n "abc123..." > /tmp/lo-challenge.txt
  ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n lo-cli /tmp/lo-challenge.txt
  # 生成 /tmp/lo-challenge.txt.sig

  # 获取签名 base64 和公钥指纹
  SIG=$(base64 -w0 /tmp/lo-challenge.txt.sig)
  FP=$(ssh-keygen -lf ~/.ssh/id_ed25519.pub | awk '{print $2}')

  # 3. 登录获取 session token
  TOKEN=$(curl -s -X POST http://127.0.0.1:8765/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"nonce\":\"abc123...\",\"fingerprint\":\"$FP\",\"signature\":\"$SIG\"}" \
    | jq -r '.token')

  # 4. 触发本地 sync
  curl -s -X POST http://127.0.0.1:8765/api/sync \
    -H "Authorization: Bearer $TOKEN"

  # 5. 推动到远程
  curl -s -X POST http://127.0.0.1:8765/api/sync/push \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"remote":"myserver"}'
  # → {"batch":"batch_1749200000123","ops":15}

  # 6. 从远程拉取
  curl -s -X POST http://127.0.0.1:8765/api/sync/pull \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"remote":"myserver"}'
  # → {"files":5,"ops":12,"conflicts":0}

  注意：如果仓库未注册任何 SSH 公钥（未执行 lo auth add），
  则 API 无需认证，直接跳过步骤 1-3 即可。

  ┌──────────────────────────────────────────────────────────────┐
  │  写一个自动化脚本（bash）                                      │
  └──────────────────────────────────────────────────────────────┘

  将以下脚本保存为 ~/scripts/lo-auto-push.sh：

    #!/bin/bash
    # lo 自动推送脚本

    LO_SERVE="http://127.0.0.1:8765"
    REMOTE="myserver"

    # 获取 nonce
    RESP=$(curl -s -X POST "$LO_SERVE/api/auth/challenge")
    NONCE=$(echo "$RESP" | jq -r '.nonce')

    # 签名
    echo -n "$NONCE" > /tmp/lo-challenge.txt
    ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n lo-cli /tmp/lo-challenge.txt 2>/dev/null
    SIG=$(base64 -w0 /tmp/lo-challenge.txt.sig)
    FP=$(ssh-keygen -lf ~/.ssh/id_ed25519.pub | awk '{print $2}')

    # 登录
    TOKEN=$(curl -s -X POST "$LO_SERVE/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"nonce\":\"$NONCE\",\"fingerprint\":\"$FP\",\"signature\":\"$SIG\"}" \
      | jq -r '.token')

    # scan + push
    curl -s -X POST "$LO_SERVE/api/sync" \
      -H "Authorization: Bearer $TOKEN"
    RESULT=$(curl -s -X POST "$LO_SERVE/api/sync/push" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"remote\":\"$REMOTE\"}")

    echo "[$(date)] $RESULT"

  加上可执行权限并配置 cron 定时执行：

    chmod +x ~/scripts/lo-auto-push.sh
    crontab -e
    # 每天 22:00 自动推送
    0 22 * * * /bin/bash ~/scripts/lo-auto-push.sh >> ~/logs/lo-sync.log 2>&1`);

    // ============================================================
    // 六、定时自动推送
    // ============================================================
    console.log(chalk.bold.yellow('\n  六、定时自动推送'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`

  ┌──────────────────────────────────────────────────────────────┐
  │  方案 A：systemd timer（Linux，推荐）                          │
  └──────────────────────────────────────────────────────────────┘

  创建 service 文件 /etc/systemd/system/lo-auto-push.service：

    [Unit]
    Description=lo auto push to remote

    [Service]
    Type=oneshot
    User=youruser
    ExecStart=/home/youruser/scripts/lo-auto-push.sh

  创建 timer 文件 /etc/systemd/system/lo-auto-push.timer：

    [Unit]
    Description=lo auto push timer

    [Timer]
    OnCalendar=*-*-* 09:00:00
    OnCalendar=*-*-* 22:00:00
    Persistent=true

    [Install]
    WantedBy=timers.target

  启用定时器：

    sudo systemctl daemon-reload
    sudo systemctl enable --now lo-auto-push.timer
    sudo systemctl status lo-auto-push.timer

  ┌──────────────────────────────────────────────────────────────┐
  │  方案 B：cron（跨平台）                                        │
  └──────────────────────────────────────────────────────────────┘

  编辑 crontab：

    crontab -e

  添加定时任务：

    # 每天早上 9 点和晚上 10 点 push
    0 9,22 * * * /home/youruser/scripts/lo-auto-push.sh

    # 工作日每小时 push
    0 9-18 * * 1-5 /home/youruser/scripts/lo-auto-push.sh

  ┌──────────────────────────────────────────────────────────────┐
  │  方案 C：CLI 直接调用（不需要 lo serve 运行）                   │
  └──────────────────────────────────────────────────────────────┘

  如果你不想跑 lo serve，也可以直接用 CLI 做定时推送：

    0 22 * * * cd /home/youruser/notes && lo push myserver

  优点：不需要 lo serve 持续运行
  缺点：推送命令本身会触发 sync 扫描，对于大仓库（>1000 文件）
        每次会花几秒，但这对于 cron 定时任务完全可以接受

  你可以把 lo push 直接加到 cron 里，这是最简单的方式。`);

    // ============================================================
    // 七、多设备 / 多远程
    // ============================================================
    console.log(chalk.bold.yellow('\n  七、多设备与多远程管理'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  你可以注册多个远程地址，同时向多个位置推送：

    lo remote add server-a  user@server-a:/data/lo
    lo remote add server-b  user@server-b:/backup/lo
    lo remote add usb       /mnt/usb/lo-backup

    lo remote list
    # server-a → user@server-a:/data/lo
    # server-b → user@server-b:/backup/lo
    # usb      → /mnt/usb/lo-backup

    # 向不同远程推送（各自的锚点独立维护）
    lo push server-a
    lo push usb

  多设备协同（设备 A + 设备 B + 一个中继服务器）：

    设备 A                           设备 B
    ───────                         ───────
    lo init                         lo clone myserver --dest ~/notes
    lo remote add myserver ...      cd ~/notes
    lo auth add -k ~/.ssh/id_xxx    lo auth add -k ~/.ssh/id_yyy
    lo push myserver

    日常：
    lo pull myserver                lo pull myserver
    # ... 写笔记 ...                 # ... 写笔记 ...
    lo push myserver                lo push myserver

  锚点是按 (设备, 远程) 独立维护的，互不影响。
  设备 A 对 myserver 的锚点 ≠ 设备 B 对 myserver 的锚点。

  新设备加入后的密钥流程：

    1. 新设备 clone → 获取所有批次 → 其中包含 protected_*.key 文件
    2. 新设备执行 lo auth add -k <新设备的SSH私钥>
    3. lo 用新私钥派生出 KEK，加密 RepoKey，生成新的 protected_*.key
    4. 新 protected_*.key 通过下一次 push 同步到其他设备
    5. 其他设备 pull 后也获得该新设备的密钥文件`);

    // ============================================================
    // 八、安全注意事项
    // ============================================================
    console.log(chalk.bold.yellow('\n  八、部署安全注意事项'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  传输层安全：

    lo push/pull 通过 SCP 传输时，底层走 SSH 加密通道。
    攻击者截获网络包只能看到 SSH 密文，无法获取批次内容。
    确保服务器的 SSH 配置安全（禁用密码登录、只用密钥认证）。

    SSH 配置加固示例（服务器侧 /etc/ssh/sshd_config）：

      PasswordAuthentication no
      PermitRootLogin prohibit-password
      PubkeyAuthentication yes

  文件层安全：

    如果仓库已加密（lo auth add），服务器上的资源文件
    以 LOEC 加密格式（AES-256-GCM）存储。即使服务器被攻破，
    攻击者拿到的只是密文。

    但以下信息是明文存在于服务器上的：
      - batch 文件名（包含时间戳）
      - manifest.json（设备 ID、操作数量、时间戳）
      - ops.json（操作类型、RID、文件路径、散列值）
      - 文件名（加密前的原始文件名 + LOEC 后缀）

    结论：
      - 攻击者能看到你什么时候同步了、同步了多少文件、
        文件的原始路径和名称。
      - 攻击者看不到文件的内容。
      - 如果你介意文件名泄露，可以在 lo 中不使用敏感的文件名。

  密钥安全：

    RepoKey（仓库主密钥）：
      - 存储位置：.repo/keys/repo.key（未上锁时）或不存在（已上锁后）
      - 不要提交到 Git，不要把 repo.key 复制到别处
      - 如果丢失且所有设备的 SSH 私钥也丢失，笔记永久无法解密

    protected_*.key（SSH 保护的 RepoKey）：
      - 会被包含在 sync 批次中，所有设备共享
      - 没有对应 SSH 私钥的话，拿到这个文件也解不开 RepoKey

  最佳实践：

    1. 中继服务器上不要存 repo.key 明文
       → 在服务器上不初始化 lo 仓库，只创建空目录作为中继

    2. 定期备份 RepoKey 到离线存储
       → .repo/keys/repo.key 是 AES-256 密钥（64 个十六进制字符）
       → 打印到纸上或存入密码管理器

    3. 保留服务器上的历史 batch 文件
       → lo clone 需要所有历史 batch 重建仓库
       → 不要随意删除 sync_batches/ 下的文件

    4. 服务器目录权限收紧
       → chmod 700 /data/lo-notes
       → 确保只有你的用户可读写`);

    // ============================================================
    // 九、部署检查清单
    // ============================================================
    console.log(chalk.bold.yellow('\n  九、部署检查清单'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  部署前确认以下每一项：

    □ 服务器 SSH 已配置，客户端可用密钥免密登录
    □ 服务器目录已创建且有写权限
    □ 本地仓库已初始化（lo init）
    □ （可选）加密已设置（lo auth add）
    □ 远程别名已注册（lo remote add）
    □ 首次推送成功（lo push <remote>）
    □ .repo/keys/repo.key 已离线备份
    □ 服务器目录权限已收紧（chmod 700）
    □ 如需要自动化：lo serve 可正常启动且 API 认证工作正常
    □ 如需要自动化：cron / systemd timer 已配置并测试

  克隆到新设备前的检查：

    □ 新设备已生成 SSH 密钥（ssh-keygen）
    □ 新设备能用该 SSH 密钥登录服务器（用于 SCP 传输）
    □ 新设备执行 lo clone 成功
    □ 新设备执行 lo auth add 绑定 SSH 密钥（用于解密笔记内容）
    □ 新设备可正常 lo pull 获取最新变更`);

    // ============================================================
    // 十、常见问题
    // ============================================================
    console.log(chalk.bold.yellow('\n  十、常见问题'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.cyan('\n    Q: 为什么不用 Git？'));
    console.log(`
    A: Git 是版本控制工具，lo 是资源管理 + 同步工具，定位不同。
       lo 的同步粒度是"操作日志"，不是"文件差异"。
       lo 可以同步加密文件（Git 对二进制加密文件只能全量传输），
       lo 有冲突检测和保留策略，lo 不要求你理解分支/合并。

       但 lo 内部也有版本控制（staging + commit），
       两者不冲突——你可以同时使用 lo 和 Git 管理同一目录。

    Q: 可以推送到 GitHub/GitLab 当远程吗？
    A: 不行。lo 的传输协议是 SCP + batch 文件，不是 Git 协议。
       但你可以把 lo 的整个目录（包括 .repo/）纳入 Git 管理，
       然后 git push 到 GitHub。不过这不是 lo 支持的使用方式。

    Q: 服务器需要安装什么？需要装 Node.js 吗？
    A: 什么都不需要。只需要 SSH 守护进程 + 一个可写目录。
       服务器不运行任何 lo 代码。

    Q: 如果 batch 文件在传输过程中损坏了怎么办？
    A: 每个批次内含 SHA-256 校验文件（checksums.json）。
       接收方解包后会逐一验证每个文件的散列值。
       任何一个文件 hash 不匹配 → 丢弃整个批次 → 提示重试。
       不会出现"坏了一半"的状态。

    Q: 能推送到多台服务器吗？
    A: 可以。lo remote add 注册多个远程地址，分别 lo push。
       每个远程维护独立的同步锚点，互不影响。

    Q: 推送频率应该多高？
    A: 没有硬性限制。常见做法：
       - 每天工作前后各一次（pull + push）
       - 或用 cron 定时每 1-4 小时自动 push
       - 操作日志的存储成本极小（每条几百字节），
         不用担心"推送太频繁"会浪费资源

    Q: 两台设备同时推送到同一个远程会冲突吗？
    A: 不会。每台设备推送的是自己的独立 batch 文件。
       pull 时按时间顺序逐 batch 处理 ops，
       如果两台设备同时编辑了同一文件，会在 pull 阶段检测冲突
       （本地版本备份为 .conflict.loec，远程版本覆盖）。

    Q: 远程的 batch 文件可以删除吗？
    A: 不建议。lo clone 需要所有历史 batch 来重建完整的仓库状态。
       如果必须清理，至少保留最近 10-20 个 batch。
       删掉旧 batch 后，新设备 clone 会缺少早期数据。`);

    console.log(chalk.gray('\n  相关文档：'));
    console.log(chalk.gray('    lo docs sync          — 远程同步系统详解'));
    console.log(chalk.gray('    lo docs serve         — 本地 HTTP API 服务'));
    console.log(chalk.gray('    lo docs encryption    — 端到端加密系统'));
    console.log(chalk.gray('    lo docs auth          — SSH 身份认证'));
    console.log(chalk.gray('    lo docs quickstart    — 快速上手指南'));
    console.log('');
};
