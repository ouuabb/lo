const chalk = require('chalk');
const packageJson = require('../../package.json');

/**
 * lo docs — 项目功能详解
 *
 * 用法:
 *   lo docs                 显示所有主题概览
 *   lo docs <topic>         显示指定主题的详细说明
 *
 * 主题:
 *   overview     项目概述
 *   encryption   端到端加密系统
 *   auth         SSH 身份认证系统
 *   version      版本控制系统
 *   database     数据库与资源索引
 *   security     安全设计摘要
 *   quickstart   快速上手指南
 */

const SECTIONS = {

  overview: () => {
    console.log(chalk.bold.cyan('\n  lo - 项目概述'));
    console.log(chalk.gray(`  版本: ${packageJson.version}`));
    console.log(chalk.gray(`  ${packageJson.description}`));

    console.log(`
  lo 是一个本地优先的知识管理 CLI 工具。

  核心理念：
  - 数据自主：所有数据存储在本地磁盘，不依赖任何云端服务
  - 端到端加密：笔记内容在写入磁盘前加密，只有持有密钥的人能读取
  - 版本控制：类似 Git 的工作流（暂存区、提交历史）
  - SSH 认证：利用现存 SSH 密钥实现去中心化的身份验证
  - 零知识：私钥不离开设备，加密密钥不发送到任何服务器

  项目结构：
    src/commands/   → 命令处理器（CLI 入口）
    src/repo/       → 核心引擎（数据库、加密、版本控制）
    src/utils/      → 工具库（加密、SSH 认证、哈希）
    bin/            → 入口脚本`);
  },

  encryption: () => {
    console.log(chalk.bold.cyan('\n  端到端加密系统'));

    // 2.1
    console.log(chalk.bold.yellow('\n  什么是端到端加密'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  端到端加密 (End-to-End Encryption, E2EE) 确保数据在写入磁盘前加密，
  在读取时才解密。即使攻击者获取硬盘，没有密钥也无法读取。

        你的设备                              磁盘
    ┌──────────────┐                    ┌──────────────┐
    │ 纯文本笔记    │ ── AES-256-GCM ──► │ LOEC 密文    │
    │ "今天的想法"  │                    │ 0x4C4F4543... │
    └──────────────┘                    └──────────────┘
           ▲                                    │
           │         AES-256-GCM 解密            │
           └────────────────────────────────────┘

  核心保证：
  - 机密性：没有密钥的人无法读取文件内容
  - 完整性：GCM 认证标签检测任何文件篡改
  - 前向安全性：每次加密使用不同的随机 IV
  - 密钥不传输：加密密钥仅存在于设备内存中`);

    // 2.2
    console.log(chalk.bold.yellow('\n  加密算法：AES-256-GCM'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo 使用 AES-256-GCM 作为核心加密算法。
  这是目前最广泛使用和认可的对称加密方案之一。

  ┌──────────────────────────────────────────────────┐
  │  参数              │  值                         │
  ├──────────────────────────────────────────────────┤
  │  算法              │  AES                         │
  │  密钥长度          │  256-bit (32 字节)           │
  │  模式              │  GCM (Galois/Counter Mode)   │
  │  分类              │  AEAD (认证加密)             │
  │  IV 长度           │  96-bit (12 字节)，随机生成  │
  │  认证标签长度      │  128-bit (16 字节)           │
  └──────────────────────────────────────────────────┘

  GCM 模式同时在加密过程中生成认证标签。
  解密时先验证标签，只有通过才返回明文——保证密文完整性。

  为什么选择 AES-256-GCM：
  - AES-256 被 NIST、NSA 认可用于最高密级数据保护
  - GCM 模式支持硬件加速（AES-NI 指令集）
  - 单一操作同时提供加密和认证，减少出错可能`);

    // 2.3
    console.log(chalk.bold.yellow('\n  LOEC 文件格式'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  加密文件采用 LOEC (Log End-to-End Encrypted) 二进制格式。

  二进制布局：

   偏移量   大小     字段          描述
   ───────────────────────────────────────────
    0        4 字节   MAGIC         魔数 "LOEC" (0x4C4F4543)
    4        2 字节   VERSION       格式版本 (当前: 0x0001)
    6        12 字节  IV            随机初始化向量 (96-bit)
    18       n 字节   CIPHERTEXT    AES-256-GCM 加密密文
    18+n     16 字节  TAG           GCM 认证标签

  格式特性：
  - 自描述：魔数和版本号使文件格式可自动识别
  - 向前兼容：版本号预留了未来算法升级的空间
  - 最小开销：每文件仅增加 34 字节 (18 头部 + 16 标签)`);

    // 2.4
    console.log(chalk.bold.yellow('\n  密钥分层架构'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  两层密钥架构，将"加密文件"和"保护密钥"分离：

    ┌─────────────────────────────────────┐
    │  Layer 1: RepoKey (AES-256, 32字节)  │
    │  用途：直接加密/解密所有资源文件     │
    │  生命周期：仓库创建时生成，永久不变   │
    │  存储：.repo/keys/repo.key (0o600)   │
    └──────────────┬──────────────────────┘
                   │ 由 KEK 加密保护
                   ▼
    ┌─────────────────────────────────────┐
    │  Layer 2: KEK (Key Encryption Key)   │
    │  用途：加密保护 RepoKey             │
    │  派生：SSH私钥 → HKDF-SHA256        │
    │  存储：.repo/keys/protected_<fp>.key │
    │  每台设备独立生成                     │
    └─────────────────────────────────────┘

  设计优势：
  1. 修改 SSH 密钥不需要重新加密所有笔记
  2. 每台设备用各自的 SSH 密钥保护同一把 RepoKey
  3. 可以安全地添加/移除设备的访问权限`);

    // 2.5
    console.log(chalk.bold.yellow('\n  密钥派生：HKDF-SHA256 (RFC 5869)'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  绑定 SSH 密钥时，从 SSH 私钥派生出 Key Encryption Key：

    SSH 私钥文件内容 (任意长度)
              │
              ▼
    ┌─────────────────────┐
    │  HKDF-Extract       │  PRF: HMAC-SHA256
    │  Salt: 固定随机盐   │
    └─────────┬───────────┘
              │  PRK (32 bytes)
              ▼
    ┌─────────────────────┐
    │  HKDF-Expand        │  PRF: HMAC-SHA256
    │  Info: "lo-repo-    │  Length: 32
    │    key-protection-  │
    │    v1"              │
    └─────────┬───────────┘
              │  KEK (256-bit, 32 bytes)
              ▼

  参数说明：
  - IKM：SSH 私钥文件的完整字节内容
  - Salt：32 字节安全随机盐值（防彩虹表）
  - Info："lo-repo-key-protection-v1"（上下文绑定）
  - 输出：256-bit KEK

  安全性：
  - HKDF 将非均匀输入转化为均匀密钥
  - Salt 防止预计算攻击
  - Info 绑定用途，防止密钥重用`);

    // 2.6
    console.log(chalk.bold.yellow('\n  日常加密行为对照'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  ┌────────────┬──────────────────────────────────┐
  │  操作      │  加密行为                         │
  ├────────────┼──────────────────────────────────┤
  │  lo init   │  生成 32 字节 RepoKey             │
  │  lo new    │  创建笔记 → 加密写入磁盘          │
  │  lo import │  读取源文件 → 加密后存储          │
  │  lo show   │  解密 → 显示明文                  │
  │  lo edit   │  解密 → 编辑 → 重新加密           │
  │  lo sync   │  解密 → 计算明文散列 → 比较      │
  │  lo backup │  复制文件，排除 .repo/keys/      │
  └────────────┴──────────────────────────────────┘`);
  },

  auth: () => {
    console.log(chalk.bold.cyan('\n  SSH 身份认证系统'));

    // 3.1
    console.log(chalk.bold.yellow('\n  为什么需要 SSH 认证'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  RepoKey 绑定 SSH 前以明文存储。SSH 认证后：

  ┌────────────────────────┬────────────┬────────────┐
  │                        │  无 SSH     │  有 SSH     │
  ├────────────────────────┼────────────┼────────────┤
  │  repo.key (明文)       │  存在       │  不存在     │
  │  protected_xxx.key     │  不存在     │  存在       │
  │  攻击者获取磁盘后      │  直接解密   │  无法解密   │
  │  安全等级              │  基础       │  增强       │
  └────────────────────────┴────────────┴────────────┘

  认证流程：
  1. 运行 lo 命令 → 触发认证检查
  2. 检查会话缓存（15 分钟 TTL）
  3. 读取已注册的公钥列表
  4. 匹配本地 SSH 密钥
  5. 用本地私钥对 256-bit nonce 签名
  6. 用注册的公钥验证签名
  7. 通过 → HKDF 派生 KEK → 解密 protected_*.key
  8. 保存会话缓存`);

    // 3.2
    console.log(chalk.bold.yellow('\n  挑战-应答认证协议'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  基于 SSH 签名的挑战-应答协议，私钥不离开设备：

    ┌──────────────┐          ┌──────────────┐
    │  验证方(DB)   │          │  证明方(私钥) │
    └──────┬───────┘          └──────┬───────┘
           │  1. nonce=<256-bit随机> │
           │────────────────────────►│
           │                         │
           │        2. ssh-keygen    │
           │           -Y sign       │
           │                         │
           │  3. 返回签名             │
           │◄────────────────────────│
           │                         │
           │  4. ssh-keygen          │
           │     -Y verify           │
           │                         │
           │  5. 通过→解密 RepoKey    │
           │                         │

  安全特性：
  - 零知识：私钥不离开本地
  - 防重放：每次使用不同 nonce
  - 多密钥：任意一把通过即可
  - 会话缓存：15 分钟 TTL
  - 环境变量 LO_AUTH_SKIP=1 可跳过（CI/CD）`);

    // 3.3
    console.log(chalk.bold.yellow('\n  签名机制'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  主方案：ssh-keygen -Y sign / -Y verify (OpenSSH >= 8.1)

    签名：ssh-keygen -Y sign -f <私钥> -n lo-cli <challenge>
    验证：ssh-keygen -Y verify -f <allowed_signers>
            -n lo-cli -s <签名文件> < <challenge>

  降级方案：ssh-keygen -s (OpenSSH < 8.1)

  支持的密钥：Ed25519 (推荐), ECDSA, RSA`);

    // 3.4
    console.log(chalk.bold.yellow('\n  多设备支持'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  每台设备用各自的 SSH 密钥保护同一把 RepoKey：

    笔记本 (~/.ssh/id_ed25519)      台式机 (~/.ssh/id_rsa)
          │                                │
          │  lo auth add                   │  lo auth add
          │  -k ~/.ssh/id_ed25519          │  -k ~/.ssh/id_rsa
          ▼                                ▼
    ┌─────────────────────────────────────────────┐
    │  protected_<fp1>.key    protected_<fp2>.key  │
    │  (KEK_1 加密的 RepoKey)  (KEK_2 加密的 RepoKey)│
    │                                              │
    │  不同 KEK，解密出相同的 RepoKey               │
    └─────────────────────────────────────────────┘

  同步注意事项：
  - .repo/ 目录需随仓库同步（含 protected_*.key）
  - .repo/ 已在 .gitignore 中
  - 推荐 Git 管理 resources/ + rsync 同步 .repo/`);

    // 3.5
    console.log(chalk.bold.yellow('\n  会话缓存'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  缓存文件：%TEMP%/.lo-auth-session.json (Windows)
            /tmp/.lo-auth-session.json (Unix)

  缓存策略：
  - 默认 TTL：15 分钟（--ttl 可调）
  - 过期后下次命令触发重新认证
  - 仅对同一仓库路径有效

  性能：
  - 首次认证：约 1-3 秒
  - 缓存命中：几乎零开销
  - 加密 I/O 开销通常 < 5%

  环境变量：
    LO_AUTH_SKIP=1  跳过认证（CI/CD 环境）`);
  },

  version: () => {
    console.log(chalk.bold.cyan('\n  版本控制系统'));
    console.log(`
  lo 内置类似 Git 的版本控制工作流：

    文件系统              暂存区              仓库历史
  ┌──────────┐       ┌──────────────┐       ┌──────────┐
  │ resources/ │  lo   │ staging.json │  lo   │ commits  │
  │ 文件变更   │ ────► │  暂存列表     │ ────► │ 表       │
  └──────────┘  add  └──────────────┘ commit └──────────┘

  命令映射：
    lo add <文件>       加入暂存区
    lo commit -m <信息>  提交为历史记录
    lo reset [文件]     取消暂存
    lo log              查看提交历史
    lo status           查看变更状态

  commits 表结构：
    - id：自增主键
    - message：提交信息
    - timestamp：时间戳
    - added / deleted / renamed：变更统计

  与 Git 的关系：
    两者可并行使用——Git 管理文件版本，lo 管理元数据和搜索。
    .repo/ 目录应在 .gitignore 中排除。`);
  },

  database: () => {
    console.log(chalk.bold.cyan('\n  数据库与资源索引'));
    console.log(`
  lo 使用 SQLite 作为本地数据库。

  ┌──────────────┬──────────────────────────┐
  │  表名        │  用途                     │
  ├──────────────┼──────────────────────────┤
  │  resources   │  资源元数据（RID、路径、   │
  │              │  哈希、类型、加密状态等）  │
  │  relations   │  资源间的双向链接关系     │
  │  commits     │  提交历史记录             │
  │  sync_config │  配置键值对（认证设置）    │
  │  sync_log    │  同步操作日志             │
  └──────────────┴──────────────────────────┘

  resources 表核心字段：
    rid         唯一标识符（res_xxx 格式）
    type        类型（note, image, pdf 等）
    path        文件系统路径
    hash        明文 SHA-256 散列（变更检测）
    metadata    JSON 元数据（标题、字数等）
    encrypted   加密状态（0=明文, 1=已加密）
    deleted     软删除标记

  散列的用途：
  - 变更检测：比较文件当前散列与 DB 记录
  - 去重检测：通过散列判断文件是否已导入
  - DB 中存储明文散列，不暴露文件内容

  加密感知：
  - 加密文件先解密再散列
  - DB 始终存储明文 SHA-256
  - 相同内容多次加密 → 相同散列 → 正确检测不变更`);
  },

  security: () => {
    console.log(chalk.bold.cyan('\n  安全设计摘要'));
    console.log(`
  ┌─────────────────────────────┬─────────────────────────┐
  │  安全措施                    │  说明                    │
  ├─────────────────────────────┼─────────────────────────┤
  │  密钥权限 0o600              │  仅所有者可读写          │
  │  GCM 认证标签               │  自动检测文件篡改        │
  │  随机 IV (每次加密不同)      │  相同明文产生不同密文    │
  │  close() fill(0) 内存擦除   │  密钥不留内存残留        │
  │  getter 返回 Buffer 副本     │  防引用被意外清零        │
  │  backup 排除 .repo/keys/    │  密钥不随备份传播        │
  │  HKDF Salt + Info 绑定       │  防预计算和密钥重用      │
  │  execFileSync               │  防命令注入              │
  │  挑战 nonce 随机化           │  防重放攻击              │
  └─────────────────────────────┴─────────────────────────┘`);
  },

  quickstart: () => {
    console.log(chalk.bold.cyan('\n  快速上手指南'));
    console.log(`
  # 1. 创建新仓库
  lo init

  # 2. 生成 SSH 密钥（如果没有）
  ssh-keygen -t ed25519 -C "lo-notebook"

  # 3. 绑定 SSH 密钥保护加密密钥
  lo auth add -k ~/.ssh/id_ed25519 -l "我的电脑"

  # 4. 创建笔记
  lo new "我的第一篇加密笔记"

  # 5. 暂存和提交
  lo add .
  lo commit -m "初始导入"

  # 6. 日常操作
  lo list          # 查看所有笔记
  lo find "关键词"  # 搜索
  lo edit res_xxx  # 编辑
  lo show res_xxx  # 查看
  lo status        # 查看变更

  # 7. 备份
  lo backup --dest ~/backups

  更多信息：
    lo manual <命令名>   查看特定命令的用法
    lo help              查看简洁命令列表`);
  }
};

const TOPIC_ALIASES = {
  overview: 'overview',
  encryption: 'encryption',
  encrypt: 'encryption',
  e2ee: 'encryption',
  auth: 'auth',
  ssh: 'auth',
  version: 'version',
  vc: 'version',
  database: 'database',
  db: 'database',
  security: 'security',
  safe: 'security',
  quickstart: 'quickstart',
  start: 'quickstart',
  guide: 'quickstart'
};

function printIndex() {
  console.log(chalk.bold.cyan('\n  lo - 项目功能详解'));
  console.log(chalk.gray(`  版本: ${packageJson.version}  |  ${packageJson.description}`));
  console.log(chalk.gray('  用法: lo docs <topic>    查看指定主题'));
  console.log(chalk.gray('  用法: lo docs             显示本索引'));

  const topics = [
    { id: 'overview',    name: '项目概述',       desc: '核心理念、数据自主、零知识架构' },
    { id: 'encryption',  name: '端到端加密系统',  desc: 'AES-256-GCM、LOEC 格式、密钥分层、HKDF' },
    { id: 'auth',        name: 'SSH 身份认证',    desc: '挑战-应答协议、多设备支持、会话缓存' },
    { id: 'version',     name: '版本控制系统',    desc: '暂存区、提交历史、状态检测' },
    { id: 'database',    name: '数据库与索引',    desc: 'SQLite 表结构、明文散列、加密感知' },
    { id: 'security',    name: '安全设计摘要',    desc: '9 项安全措施一览' },
    { id: 'quickstart',  name: '快速上手指南',    desc: '从 init 到 backup 的完整命令序列' }
  ];

  console.log('');
  for (const t of topics) {
    console.log('  ' + chalk.yellow(('lo docs ' + t.id).padEnd(22)) + chalk.gray(t.desc));
  }
  console.log('');
}

module.exports = function docs(argv) {
  const topic = (argv && argv.topic) || (argv && argv._ && argv._[1]);
  const resolved = TOPIC_ALIASES[topic] || null;

  if (!resolved) {
    if (topic) {
      console.log(chalk.red(`\n  未找到主题: ${topic}`));
      console.log(chalk.gray('  运行 lo docs 查看所有可用主题'));
      return;
    }
    printIndex();
    return;
  }

  SECTIONS[resolved]();
};
