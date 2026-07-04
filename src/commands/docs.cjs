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

  concepts: () => {
    console.log(chalk.bold.cyan('\n  lo - 核心设计观念'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、资源平等 —— 万物皆资源'));
    console.log(`
  在 lo 中，仓库里的每一个个体都被视为一个“资源”，没有任何区分。
  无论是 Markdown 笔记、PDF 论文、PNG 截图、二进制文件还是自定义格式的
  数据，一旦进入仓库，它们就是完全平等的资源。

  这种设计的含义：

  ┌─────────────────────────────────────────────────────────────┐
  │  资源类型        │  在 lo 中的行为                         │
  ├─────────────────────────────────────────────────────────────┤
  │  .md 笔记        │  创建 → 散列 → 索引 → 可搜索           │
  │  .pdf 论文       │  创建 → 散列 → 索引 → 不可搜索内容     │
  │  .png 截图       │  创建 → 散列 → 索引 → 不可搜索内容     │
  │  .jpg 照片       │  创建 → 散列 → 索引 → 不可搜索内容     │
  │  任意二进制文件   │  创建 → 散列 → 索引 → 不可搜索内容     │
  └─────────────────────────────────────────────────────────────┘

  统一的处理流程：文件进入 resources/ 目录 → 计算 SHA-256 明文散列
  → 可选加密为 LOEC 格式 → 写入数据库索引。

  不存在“笔记”和“附件”的区别。不存在“文本文件”和“二进制文件”的区别。
  不存在“可 diff”和“不可 diff”的区别。所有资源共享同一套操作：
  - create（创建）
  - update（更新 → 实际上新散列 = 新资源）
  - delete（软删除）
  - move（移动/重命名）
  - tag（标记）

  这种设计使得 lo 并非“笔记软件附带文件管理”，而是一个通用的、版本化的、
  加密的内容定位仓库，其中文本笔记只是资源的一种而已。

  设计目的：
  - 用户不需要区分“文件夹”和“标签”，一维的标签体系覆盖所有
  - 搜索、过滤、关联在所有资源类型上统一可用
  - 跨设备同步时所有资源同等对待，没有特殊路径
  - 未来扩展（如添加对 .py/.js 代码文件的 diff 支持）不影响现有模型`);

    console.log(chalk.bold.yellow('\n  二、RID 唯一且独立 —— 标识符是纯粹的'));
    console.log(`
  每个资源在创建时被分配一个 RID（Resource Identifier，资源标识符），
  格式为 "res_" 前缀 + 随机字符串，例如 "res_a1b2c3d4e5"。

  RID 的核心特性：

  1. 随机生成，不派生自任何属性
     RID 由 crypto.randomBytes 生成，与文件内容、散列、路径、创建时间、
     文件类型、加密状态等任何属性都无关。
     即使两个文件内容完全相同的资源，它们的 RID 也必然不同。

  2. RID 是资源的永久身份
     一旦创建，RID 永不变更。资源在仓库内的整个生命周期中，
     无论内容被修改多少次、路径被移动多少次、标签被添加或删除多少次，
     RID 始终不变。
     （当资源内容修改时，产生的是一个新的散列值，并非新的 RID。）

  3. RID 为什么不能与 hash 绑定
     - 内容可能重复：两个 PDF 文件内容相同，不应该用同一个 RID
     - 散列可能碰撞：即使概率极低，RID 的随机性要求其不能依赖散列
     - 更新产生新散列：资源更新时，散列变化但资源身份不变
     - 加密影响散列：加密文件存储的是明文散列，但 RID 独立于此
     - 语义上：RID 代表“这个实体”，散列代表“这个状态”

  4. RID 为什么不能与路径绑定
     - 资源可以被移动/重命名（路径变化但身份不变）
     - 路径是元数据，不是身份

  5. RID 为什么不能与文件名绑定
     - 两个资源可以有相同文件名但内容不同
     - 文件名可随时修改

  6. 跨设备同步中的 RID
     操作日志在同步时携带 RID，接收方原样记录。
     不存在“两台设备生成不同的 RID 指向同一个资源”的冲突，
     因为 RID 由创建设备生成并随操作日志传播，接收方不会重新生成。`);

    console.log(chalk.bold.yellow('\n  三、资源是不可变实体'));
    console.log(`
  在 lo 的存储模型中，资源的内容是不可变的。

  当你修改一个资源的文件内容时：
    原始状态:  RID=res_abc,  hash=sha256_A,  文件内容=版本1
    修改后:    RID=res_abc,  hash=sha256_B,  文件内容=版本2

  RID 不变（仍然是同一个资源），但 hash 变了（内容变了）。

  提交历史记录了每次散列的变化，你可以通过 lo log 查看。

  如果启用了加密：
    加密前的明文版本1 → 散列 sha256_A → 加密为 LOEC 密文
    加密前的明文版本2 → 散列 sha256_B → 加密为 LOEC 密文

  数据库存储的始终是明文散列。这意味着加密文件的变更可以通过
  明文散列精确检测，而密文（含随机 IV）每次都会不同。`);
  },

  encryption: () => {
    console.log(chalk.bold.cyan('\n  端到端加密系统'));

    // 2.0
    console.log(chalk.bold.yellow('\n  一页通：从零到懂'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  别急，先忘掉所有术语。用一段对话讲清楚所有事情。

  ── 第一幕：创建仓库 (lo init) ──

  "我要建一个新仓库。"
  lo 说："好，我给你造一把钥匙，叫 RepoKey。"
  "这是什么？"
  lo 说："这把钥匙用来锁你的笔记。每次写新笔记，都用它加密成乱码。
         没有这把钥匙，乱码就变不回来。"
  "钥匙放哪？"
  lo 说："放在 .repo/keys/repo.key。注意，现在是明文放的，
         谁拿到这个文件都能开你的笔记。"

  ── 第二幕：上锁 (lo auth add) ──

  "明文放不安全啊。"
  lo 说："那就上锁。我需要借你的 SSH 私钥用一下。"
  "怎么用？"
  lo 说："我不拿走你的私钥。我读一下私钥的内容，算出另一把钥匙，
         叫 KEK。然后用 KEK 把 RepoKey 加密，加密结果存到
         .repo/keys/protected_xxx.key，最后删掉明文的 repo.key。"
  "protect_xxx.key 是什么？"
  lo 说："就是把 RepoKey 锁在里面的盒子。没有你的 SSH 私钥，
         谁也打不开这个盒子。"
  "那我的 SSH 私钥存在盒子里吗？"
  lo 说："不在。盒子里只存加密后的 RepoKey。解密时需要你的
         SSH 私钥参与计算，没有私钥就解不出来。"

  ── 第三幕：日常使用 (lo show / lo edit) ──

  "我要看笔记。"
  lo 说："先证明你是谁。我用你的 SSH 私钥算一把 KEK，
         用 KEK 打开 protected_xxx.key 盒子，拿到 RepoKey，
         再用 RepoKey 解密你的笔记。"
  "这过程快吗？"
  lo 说："第一次几秒钟。通过之后缓存 15 分钟，
         这期间再操作就几乎没感觉了。"

  ── 第四幕：另一台电脑 (lo clone / lo pull) ──

  "我在另一台电脑 B 上 clone 了仓库，怎么打不开文件？"
  lo 说："因为 B 上的 repo.key 是全新随机生成的，和 A 的不一样。
         A 用它的钥匙锁的门，B 的钥匙打不开。"
  "那怎么办？"
   lo 说："需要把 A 的明文 repo.key 安全传到 B 上。具体分两种情况：

          情况一：A 上还没执行过 lo auth add（repo.key 还是明文）
            1. A 上 scp .repo/keys/repo.key → B 的 .repo/keys/repo.key
            2. B 上 lo auth add（用自己的 SSH 私钥加密 repo.key）
            3. A 上 lo auth add（用自己的 SSH 私钥加密 repo.key）

          情况二：A 上已经执行过 lo auth add（repo.key 已删）
            1. A 上 lo auth remove 恢复明文 repo.key
            2. scp 传到 B
            3. A 上重新 lo auth add
            4. B 上 lo auth add

          最终两台电脑各自有自己的 protected_xxx.key，
          锁的是同一把 RepoKey，都能解密文件。"

  ── 核心角色速查 ──

  角色          │  是什么           │  类比
  ──────────────┼──────────────────┼─────────────────
  RepoKey       │  随机 AES-256 密钥 │  房门钥匙
  SSH 私钥      │  你的身份凭证     │  你的指纹
  KEK           │  从 SSH 私钥算出的 │  打开保险柜的钥匙
  protected.key │  加密后的 RepoKey  │  锁了房门钥匙的保险柜
  LOEC 密文     │  加密后的笔记     │  锁着的门

  流程：
  SSH 私钥 → 算出 KEK → 打开 protected.key → 拿到 RepoKey → 解密笔记

  底线：除了你的设备，没有任何地方存着能解密文件的完整信息。`);

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

    // 2.7
    console.log(chalk.bold.yellow('\n  完整机制详解：从 init 到日常读写'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  下面用从头到尾的顺序，完整解释加密机制如何运转。

  ── 阶段一：仓库初始化 (lo init) ──

  1. lo init 执行，调用 crypto.randomBytes(32)
  2. 生成一把全新的、随机的 256-bit RepoKey
  3. 将 RepoKey 以明文写入 .repo/keys/repo.key（权限 0o600）
  4. 此时任何能读取该文件的人都能解密你的笔记

  此时的密钥关系：

      .repo/keys/repo.key (明文, 32字节随机数)
                │
                │  直接用于 AES-256-GCM 加密
                ▼
          你的笔记文件 ← 加密 → LOEC 密文写入磁盘

  ── 阶段二：绑定 SSH 密钥 (lo auth add) ──

  这是可选但强烈推荐的一步。目的：把明文的 RepoKey 锁起来。

  1. lo auth add -k ~/.ssh/id_ed25519 -l "我的电脑"
  2. 读取 ~/.ssh/id_ed25519 私钥文件的完整字节内容
  3. 通过 HKDF-SHA256 从私钥内容派生出 KEK（Key Encryption Key）
     - 输入：私钥字节 + 随机 Salt + "lo-repo-key-protection-v1" 上下文
     - 输出：32 字节 KEK
  4. 用 KEK 通过 AES-256-GCM 加密 RepoKey
  5. 加密结果写入 .repo/keys/protected_<指纹>.key
  6. 删除明文的 .repo/keys/repo.key

  此时密钥关系变成：

      你的 SSH 私钥                    RepoKey (AES-256)
      (~/.ssh/id_ed25519)                    │
            │                                │
            ▼                                ▼
      HKDF-SHA256                      加密你的笔记
            │
            ▼
          KEK ──AES-256-GCM──→ .repo/keys/protected_xxx.key
                              (加密后的 RepoKey)

  注意：RepoKey 本身没有变，只是换了个存放方式——
  从"明文放桌上"变成"锁在盒子里，盒子用你的 SSH 私钥打开"。

  ── 阶段三：日常使用 (lo show / lo edit) ──

  每次运行需要解密文件时，触发解锁流程：

  1. 检查会话缓存（15 分钟 TTL，命中直接跳过）
  2. 读取 .repo/keys/protected_<指纹>.key → 得到加密的 RepoKey
  3. 读取 SSH 私钥文件内容
  4. 用相同的 HKDF 参数派生出相同的 KEK
  5. 用 KEK 解密 protected_xxx.key → 得到 RepoKey（仅存于内存）
  6. 用 RepoKey 解密资源文件 → 明文内容
  7. 使用完毕：fill(0) 擦除内存中的 RepoKey

  缓存命中的情况：
    第一次 lo show → 完整认证流程（约 1-3 秒）
    15分钟内 lo show / lo edit → 直接使用缓存的 RepoKey（几乎零开销）

  ── 密钥关系总结 ──

  角色          │  名称       │  来源           │  存储位置
  ──────────────┼────────────┼────────────────┼──────────────────────────
  数据加密密钥   │  RepoKey   │  随机生成        │  仅内存（或明文 repo.key）
  密钥保护密钥   │  KEK       │  SSH 私钥派生    │  仅内存（不存储）
  身份凭证       │  SSH 私钥   │  用户生成        │  ~/.ssh/id_ed25519
  受保护密钥     │  protected │  KEK 加密 RepoKey │  .repo/keys/protected_xxx.key

  关键事实：
  - RepoKey 不是从 SSH 私钥派生的，它是独立随机数
  - SSH 私钥只用于"锁住" RepoKey，不参与文件加解密
  - 没有 SSH 私钥 → 打不开盒子 → 不能解密文件
  - 知道了 SSH 私钥 ≠ 知道 RepoKey（必须先解锁 protected_xxx.key）`);

    // 2.8
    console.log(chalk.bold.yellow('\n  加密与远程同步'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  加密仓库的跨设备同步需要额外处理密钥分发。

  ── 同步过程中文件的状态 ──

  资源文件在传输过程中始终保持 LOEC 加密格式：

    电脑 A                                      电脑 B
    ──────                                      ──────
    笔记明文                                    笔记明文
      │                                            ▲
      ▼  RepoKey_A 加密                             │  RepoKey_A 解密
      │                                            │
    LOEC 密文 ──→ 服务器 ──→ 下载 ──→ LOEC 密文
      (加密状态不变)                      (同一份密文)

  关键点：资源文件在服务器上、传输过程中始终是加密的。
  即使服务器被攻破，攻击者也只能拿到密文。

  ── RepoKey 如何传递到另一台设备 ──

  push 时不会自动传输 RepoKey（那样等于给自己加后门）。
  你需要手动将 RepoKey 安全地传递到第二台设备。

  方法一：通过 SSH 安全复制（推荐）
    # 在电脑 B 上
    lo clone user@server:/notes --dest ./notes
    # 此时 B 的 RepoKey 是随机新生成的，解不开 A 的资源文件

    # 在电脑 A 上，将 repo.key 复制到 B
    scp .repo/keys/repo.key user@b电脑:~/notes/.repo/keys/repo.key

    # 回到电脑 B，绑定自己的 SSH 密钥保护这把密钥
    cd notes
    lo auth add -k ~/.ssh/id_ed25519 -l "电脑B"

  方法二：离线传递
    1. 在电脑 A 上查看 repo.key：cat .repo/keys/repo.key | base64
    2. 通过安全渠道（如 Signal/加密邮件）将 base64 发送到 B
    3. 在电脑 B 上写入：echo "<base64>" | base64 -d > .repo/keys/repo.key
    4. 在电脑 B 上运行 lo auth add 绑定本地 SSH 密钥

  方法三：两设备共享同一 SSH 密钥
    如果你的两台电脑使用相同的 SSH 密钥对：
    - 将 .repo/keys/ 和 .repo/database.sqlite 都复制到电脑 B
    - lo auth add 已绑定好的 protected_xxx.key 可直接使用

  ── "端到端"在此处的含义 ──

  加密 → 传输 → 解密，中间任何环节（包括服务器）都无法读取明文。
  这就是"端到端"的含义：只有你的设备（持有密钥的端点）能读写明文。

  ── 多设备密钥管理 ──

  全部设备共享同一把 RepoKey，但各用各的 SSH 密钥保护它：

      .repo/keys/
        protected_<设备A指纹>.key   ← A 的 KEK 加密的 RepoKey
        protected_<设备B指纹>.key   ← B 的 KEK 加密的 RepoKey

  各设备用自己的 SSH 私钥解密对应的 protected 文件，
  得到的是同一把 RepoKey，因此都能加密和解密相同的资源文件。`);
  },

  auth: () => {
    console.log(chalk.bold.cyan('\n  SSH 身份认证系统'));

    // 3.0
    console.log(chalk.bold.yellow('\n  先搞清楚：SSH 在这个项目里到底做什么'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  一句话：SSH 只做一件事——保护 RepoKey 不被别人直接拿走。

  lo 的加密核心是 RepoKey（一个随机 32 字节密钥），文件加解密从头到尾
  都是它的活。SSH 全程不参与文件加密。

  没有 SSH：RepoKey 明文放 .repo/keys/repo.key
           → 偷你硬盘的人直接拿走，能解密所有文件

  有 SSH：  RepoKey 被锁进 protected_xxx.key
           → 偷你硬盘的人拿到也打不开，缺 SSH 私钥

  所以：
  - SSH 是"门锁"，不是"门"
  - 只要你有 RepoKey 本身（不管经过 SSH 没），就能解密文件
  - 安全备份的是 RepoKey，不是 SSH 密钥
  - 本节的挑战-应答、签名验证等全部是为了安全地取出 RepoKey 而设计的`);

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

  sync: () => {
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
  concepts: 'concepts',
  concept: 'concepts',
  philosophy: 'concepts',
  design: 'concepts',
  rid: 'concepts',
  resource: 'concepts',
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
  sync: 'sync',
  push: 'sync',
  pull: 'sync',
  clone: 'sync',
  remote: 'sync',
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
    { id: 'concepts',    name: '核心设计观念',   desc: '资源平等、RID 独立性、不可变实体' },
    { id: 'encryption',  name: '端到端加密系统',  desc: 'AES-256-GCM、LOEC格式、密钥分层、HKDF、完整机制、同步中的加密' },
    { id: 'auth',        name: 'SSH 身份认证',    desc: '挑战-应答协议、多设备支持、会话缓存' },
    { id: 'version',     name: '版本控制系统',    desc: '暂存区、提交历史、状态检测' },
    { id: 'database',    name: '数据库与索引',    desc: 'SQLite 表结构、明文散列、加密感知' },
    { id: 'security',    name: '安全设计摘要',    desc: '9 项安全措施一览' },
    { id: 'sync',       name: '远程同步系统',    desc: '多设备同步、操作日志、冲突处理' },
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
