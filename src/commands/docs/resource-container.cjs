const chalk = require('chalk');

module.exports = function() {
  console.log(chalk.bold.cyan('\n  Resource、Container Capability 与 Member 模型'));

  // 概述
  console.log(chalk.bold.yellow('\n  设计概述'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  lo 的 Resource 模型将"资源身份"与"内容来源"解耦：

    - Resource: 独立的一等公民实体，拥有唯一 RID
    - Content Source: Resource 的内容来源（本地目录、Git 仓库等）
    - Container: 具有 container capability 的 Resource，可以管理成员
    - Member: 容器中的文件条目（File Member）或已提升的 Resource（Resource Member）

  核心理念：任何文件都可以是容器的普通成员（File Member），
  当需要对某个成员进行标记、引用、分类时，通过 lo container promote 提升为独立 Resource。`);

  // Resource
  console.log(chalk.bold.yellow('\n  Resource'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  Resource 是所有实体的基础。每个 Resource:

    rid             唯一标识符（如 res_abc123_xxxxxxxx）
    name            逻辑名称（全局唯一，活跃层）
    type            资源类型（project, album, dataset, course, collection, note, code...）
    capabilities    JSON 数组，描述资源的能力（如 ["container"]）
    container_schema JSON 对象，容器的成员规则

  Resource 的 type 决定其默认行为:

  ┌─────────────┬──────────────┬──────────────────────────────────┐
  │ type         │ capabilities  │ container_schema (allowed_types)  │
  ├─────────────┼──────────────┼──────────────────────────────────┤
  │ project      │ ["container"] │ note, document, image, code,      │
  │              │              │ json, yaml, xml, csv, text         │
  │ album        │ ["container"] │ image, video                      │
  │ dataset      │ ["container"]  │ csv, json, yaml, xml              │
  │ course       │ ["container"] │ note, video, audio, document,     │
  │              │              │ image, pdf                         │
  │ collection   │ ["container"]  │ (无限制)                           │
  └─────────────┴──────────────┴──────────────────────────────────┘`);

  // Content Source
  console.log(chalk.bold.yellow('\n  Content Source'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  Resource 通过 resource_sources 表绑定内容来源:

    resource_sources 表结构:
    - resource_rid    Resource 的 RID
    - source_type     来源类型（local_folder, git_repository, zip_archive, remote_storage）
    - location        来源位置（本地路径 / URL）
    - metadata        附加元数据（JSON）

  支持的来源类型:
    local_folder     本地文件夹（最常见，如项目目录）
    git_repository    Git 远程仓库
    zip_archive       ZIP 压缩包
    remote_storage    远程存储
    database          数据库

  一个 Resource 可以绑定多个 Content Source。例如，一个项目 Resource
  可以同时从本地目录和远程 Git 仓库获取内容。

  Content Source 与 Resource 身份是解耦的:
    - Resource 的 RID 不依赖于 Content Source 的位置
    - Content Source 可以被替换而不影响 Resource 身份
    - 同一个 Content Source 可以被多个 Resource 引用`);

  // Container Capability
  console.log(chalk.bold.yellow('\n  Container Capability'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  具有 "container" capability 的 Resource 是容器。

  容器的核心能力:
    1. 管理成员（container_members 表）
    2. 按 container_schema 过滤成员类型
    3. 扫描 Content Source 目录自动同步成员列表
    4. 支持 promote / demote 操作

  创建容器时:
    lo create resource project ./demo

    1. 创建 Resource（type=project, capabilities=["container"]）
    2. 绑定 Content Source（./demo → resource_sources）
    3. 扫描目录，将支持的文件添加为 File Member
    4. 按 container_schema 过滤（project 接受 note/code/image 等）

  成员类型过滤逻辑:
    scan_dir()  →  检查扩展名支持  →  检查 allowed_types  →  计算 hash  →  入库

    如果 container_schema.allowed_types 为空数组，则不限制。`);

  // Member 模型
  console.log(chalk.bold.yellow('\n  Member 模型'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  container_members 表存储容器中的所有成员:

  ┌─────────────────┬─────────────────────────────────────────────┐
  │ 字段             │ 说明                                         │
  ├─────────────────┼─────────────────────────────────────────────┤
  │ id               │ 自增主键                                     │
  │ container_rid    │ 所属容器的 RID                               │
  │ resource_rid     │ 提升后的 Resource RID（NULL = File Member）  │
  │ path             │ 容器内的相对路径                             │
  │ name             │ 文件名                                       │
  │ size             │ 文件大小                                     │
  │ hash             │ 内容 SHA-256 散列                            │
  │ modified_time    │ 文件修改时间                                 │
  │ metadata         │ 元数据（JSON）                               │
  └─────────────────┴─────────────────────────────────────────────┘

  UNIQUE 约束: (container_rid, path)，同一容器内路径唯一。

  成员有两种状态:

  File Member (resource_rid = NULL):
    - 只是一个文件条目，没有独立 RID
    - 不能参与 Relation
    - 不能添加标签或分类
    - 本质上是容器的"内容索引"

  Resource Member (resource_rid = 非 NULL):
    - 已经被 promote 提升为独立的 Resource
    - 拥有独立 RID，可以参与 Relation
    - 可以添加标签、分类
    - 仍然是容器的成员（保持 container_rid 关联）`);

  // Promote / Demote 机制
  console.log(chalk.bold.yellow('\n  Promote / Demote 机制'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  lo container promote 将 File Member 提升为 Resource Member。
  lo container promote --revert 将 Resource Member 降级为 File Member。

  为什么要 Promote？

    场景：你有一个项目容器（project），里面有一个 src/auth.py 文件。
    最初它只是一个普通的 File Member。后来你发现这个认证模块需要在
    多个项目间共享，你想要:
      - 给它添加标签 "认证"、"安全"
      - 与 design.md 建立引用关系
      - 在不同的容器中引用它

    这时就需要 promote 它，让它变成一个独立的 Resource。

  Promote 流程:

    lo container promote 项目/src/auth.py

    1. 查找 container_rid（自动或手动指定）
    2. 从 Content Source 找到文件的绝对路径
    3. 调用 resourceService.create() 创建 Resource
       - type 根据扩展名推导（.py → code）
       - name 使用文件名（去掉扩展名）
    4. 更新 container_members.resource_rid 指向新 Resource
    5. 记录操作日志（member_promoted）

  幂等性:
    - 重复 promote 同一个文件不会创建新 Resource
    - containerService.promoteMember() 检测到 resource_rid 已存在时直接返回

  Promote 后:
    - 原文件不受影响
    - 新 Resource 拥有独立 RID
    - 可以与任何 Resource 建立 Relation
    - 仍然是容器的成员

  Demote（降级）:

    lo container promote 项目/src/auth.py --revert

    1. 查找 container_members 中的成员记录
    2. 将 resource_rid 设置为 NULL
    3. 成员恢复为普通 File Member
    4. Resource 本身不被删除（仍独立存在）

  降级后:
    - 成员不再关联独立 Resource
    - Resource 本身不受影响
    - 可通过 lo container promote 重新提升`);

  // 与其他系统的关系
  console.log(chalk.bold.yellow('\n  与 Relation 系统的关系'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  只有 Resource Member（已 promote）才能参与 Relation:

    File Member → 不能 link
    Resource Member → 可以 link、可以有 wikilink、可以有标签

  设计理由: File Member 没有独立 RID，缺乏稳定的引用目标。
  只有 promote 为 Resource 后，才具备参与 Relation 系统的资格。

  这确保了:
    - 每个关系都有稳定的 RID 锚点
    - 文件重命名不影响引用（基于 RID）
    - 删除容器不会丢失已提升的资源

  与 wikilink 的关系:

    [[wikilink]] 创建于 .md 文件解析时（lo sync）。
    - 如果 .md 文件的成员已被 promote，wikilink 的目标就是该 Resource
    - 如果 .md 文件的成员未被 promote，wikilink 按原有逻辑匹配
    - promote 后的 Resource 之间的 wikilink 基于 RID 维护`);

  // 数据库索引
  console.log(chalk.bold.yellow('\n  数据库索引'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  resources 表新增列:
    capabilities     TEXT     JSON 数组（如 ["container"]）
    container_schema TEXT     JSON 对象（如 {"allowed_types":["note","code"]}）

  resource_sources 表:
    idx_resource_sources_rid         按 resource_rid 查找

  container_members 表:
    idx_container_members_container  按 container_rid 查找
    idx_container_members_path       按 (container_rid, path) 唯一查找`);

  // 命令参考
  console.log(chalk.bold.yellow('\n  命令参考'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  lo create resource <type> <path>
      创建具有 Container Capability 的 Resource
      支持: project, album, dataset, course, collection
      选项: --name, --no-scan

  lo container promote <path>
      将 File Member 提升为 Resource Member（--revert 降级）
      选项: --container <rid>, --type <type>, --revert

  lo container status <rid>
      查看容器成员的状态变更（只读，对比文件系统与数据库）
      显示新增 (A)、修改 (M)、删除 (D) 的文件

  lo container scan <rid>
      同步容器成员（scan=status+apply，将文件变化应用到数据库）

  lo container list <rid>
      列出容器所有成员（--resources / --files 过滤）

  lo link <rid1> <rid2>
      promote 后的 Resource 可以参与 Relation

  lo list
      当前只列出 resources/ 目录下的资源
      Container Resource 及其成员暂不显示在 list 中

  相关 API:
    repo.createResourceWithContainer(type, path, options)
    repo.promoteMember(containerRid, memberPath, options)
    repo.demoteMember(containerRid, memberPath)
    repo.getContainerMembers(containerRid)
    repo.getContainerDiff(containerRid)
    repo.syncContainerMembers(containerRid)
    repo.getContainerMemberStats(containerRid)`);

  // Container 同步体系
  console.log(chalk.bold.yellow('\n  Container 同步体系'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  Container 拥有独立的成员同步机制，不参与 lo status/add/commit 流程:

  ┌─────────────────────────────────────────────────────┐
  │  lo 层级            │  管理内容           │  命令          │
  ├─────────────────────────────────────────────────────┤
  │  资源层 (Resource)   │  RID、Relation、标签 │  lo status     │
  │                      │  分类、元数据        │  lo add/commit │
  ├─────────────────────────────────────────────────────┤
  │  容器层 (Container)  │  文件新增/修改/删除  │  lo container  │
  │                      │  Member 索引         │  status/scan   │
  └─────────────────────────────────────────────────────┘

  工作流:

    1. lo container status <rid>    查看变更（只读）
    2. lo container scan <rid>      应用变更（同步到数据库）
    3. lo container promote <path>  将重要文件提升为 Resource

  对比机制:

    文件系统的文件 ──┬── 新增 (filesystem 有, DB 无)  → A
                     ├── 修改 (hash 不同)             → M
                     ├── 删除 (DB 有, filesystem 无)  → D
                     └── 未变 (hash 相同)             → unchanged

  promote 是分水岭:
    File Member  → lo container promote → Resource (进入资源层管线)
    此时文件变更仍然属于容器层的 content sync，但 Resource 本身
    的标签、Relation 变更属于资源层的 lo status/add/commit。`);

  // 注意事项
  console.log(chalk.bold.yellow('\n  注意事项'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  - Container Resource 的 "path" 可以是目录（不存储文件内容）
  - promote 后文件的磁盘位置不变，仅数据库层面获得独立 RID
  - promote 失败时 container_members 状态不变（原子操作）
  - 容器成员按 (container_rid, path) 唯一，同一文件不会重复添加
  - 删除容器 Resource 时，container_members 自动级联删除
  - 已 promote 的 Resource 成员不受级联删除影响（resource_rid 保留）
  - lo container scan 仅同步 member 索引（hash/name/size），不修改 resource_rid

  相关命令: lo create resource, lo container promote, lo manual resource
  相关文档: lo docs rid, lo docs wikilink`);
  console.log('');
};
