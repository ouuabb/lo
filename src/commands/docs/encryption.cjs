const chalk = require('chalk');

module.exports = function() {
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
};
