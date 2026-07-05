const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  远程同步系统'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo 的远程同步系统让你在多台设备间同步笔记库，
  同时保持端到端加密的完整性和数据自主。

  核心设计原则：
  - 以操作日志为单位同步，不同步 SQLite 文件
  - 批次原子性：每个同步批次要么全应用，要么全丢弃
  - 冲突保留：检测到冲突时保留所有版本，不静默覆盖

  ┌──────────┐   lo push    ┌──────────────┐   lo pull    ┌──────────┐
  │  设备 A   │ ──────────► │  中继/服务器   │ ◄────────── │  设备 B   │
  │  写笔记   │             │  存放批次文件   │             │  读笔记   │
  └──────────┘             └──────────────┘             └──────────┘

  命令一览：
    lo push <remote>      推送本地变更到远程
    lo pull <remote>      从远程拉取变更到本地
    lo clone <remote>     从远程克隆完整仓库

  远程地址格式：
    user@host:/path/to/repo      通过 SSH/SCP 传输
    /local/path/to/repo          本地路径（共享目录/移动硬盘）

  同步的数据：
    - resources/ 全部资源文件（保持 LOEC 加密状态）
    - 操作日志（增量变更记录）
    - 同步锚点（追踪同步进度）
    - .repo/keys/protected_*.key（各设备的密钥保护文件）

  不同步的数据：
    - database.sqlite（每台设备独立维护，可重建）
    - staging.json（暂存区状态）
    - repo.key（加密密钥，绝不随 push 上传）

  重要：加密密钥（RepoKey）不参与传输
  ─────────────────────────────────────────
    push 只传加密后的文件，不传钥匙。
    服务器上全是密文，没有解密能力。
    另一台设备需要你手动安全传递 RepoKey（详见 lo docs encryption 第 2.8 节）。
    SCP 传输用的是系统 SSH 配置，与 lo auth 管理的密钥是两套独立机制。

  操作日志类型：
    resource_created    创建资源（文件 + DB 记录）
    resource_updated    更新资源（散列变更）
    resource_deleted    删除资源
    resource_moved      移动/重命名
    resource_tagged     标签变更

  批次格式：
    每个同步批次是一个 gzipped tarball：
      manifest.json      ← 批次清单（设备 ID、时间戳、校验和列表）
      ops.json           ← 操作日志条目数组
      checksums.json     ← 所有文件 SHA-256 校验和
      resources/         ← 关联的资源文件（保持加密状态）

  批次完整性保证：
    1. 打包时计算所有文件的 SHA-256 校验和
    2. 写入 checksums.json
    3. 接收方解包后逐一验证
    4. 校验不匹配 → 丢弃整个批次 → 提示重试

  同步锚点（Anchor）：
    每对 (本地设备, 远程地址) 维护一个锚点：
    { last_op_id, last_op_timestamp }
    - push: 只发送锚点之后的新操作
    - pull: 记录远程的最后操作，下次增量拉取

  冲突检测与处理：
    ┌────────────────────┬───────────────────────────────┐
    │  冲突类型          │  处理策略                      │
    ├────────────────────┼───────────────────────────────┤
    │  edit vs edit      │  保留远程版本 + 本地存 .conflict │
    │  delete vs edit    │  保留本地编辑版本              │
    │  正常操作          │  直接应用                      │
    │  重复操作（幂等）   │  自动跳过                      │
    └────────────────────┴───────────────────────────────┘

  多设备使用流程：
    # 设备 A：创建仓库并首次推送
    lo init
    lo new "我的笔记"
    lo push user@server:/notes

    # 设备 B：克隆仓库
    lo clone user@server:/notes --dest ./notes
    cd notes
    lo auth add -k ~/.ssh/id_ed25519

    # 日常同步
    设备 A: lo push user@server:/notes
    设备 B: lo pull user@server:/notes

  安全性：
    - 传输层：SSH/SCP 提供加密通道
    - 文件层：资源文件始终以 LOEC 加密格式传输
    - 密钥层：protected_*.key 通过 SSH 私钥保护
    - 完整性：SHA-256 校验和防篡改
    - 中间人不安全：即使中继服务器被攻破，攻击者只能拿到加密密文`);
};
