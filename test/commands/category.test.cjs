/**
 * category 命令测试（新架构）
 *
 * category 命令管理资源分类，操作通过 staging stageMetadata 暂存。
 * 支持操作: set（设置分类）、rm（移除分类）、list（列出分类）、tree（树形展示）。
 */

const path = require('path');
const { setupTempRepo, teardownTempRepo, createTestFile, Repository } = require('./commandTestHelper.cjs');
const categoryCommand = require('../../src/commands/category.cjs');

describe('category command', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await setupTempRepo();
  });

  afterEach(async () => {
    await teardownTempRepo(ctx);
  });

  test('should set category on a resource', async () => {
    // 需要先有资源才能设置分类
    const repo = new Repository(ctx.tempDir);
    await repo.init();
    await createTestFile(path.join(ctx.tempDir, 'test.md'), '# Test');
    const resource = await repo.importFile(path.join(ctx.tempDir, 'test.md'));
    await repo.close();

    await categoryCommand({
      _: ['lo'],
      action: 'set',
      rid: resource.rid,
      category: '编程/Python'
    });

    // 验证暂存了 metadata 变更
    const repo2 = new Repository(ctx.tempDir);
    await repo2.init();
    const status = await repo2.staging.getStatus();
    await repo2.close();

    const stagedMeta = status.metadata.find(m => m.rid === resource.rid);
    expect(stagedMeta).toBeDefined();
    expect(stagedMeta.category).toBe('编程/Python');
  });

  test('should remove category from a resource', async () => {
    const repo = new Repository(ctx.tempDir);
    await repo.init();
    await createTestFile(path.join(ctx.tempDir, 'test.md'), '# Test');
    const resource = await repo.importFile(path.join(ctx.tempDir, 'test.md'));
    await repo.close();

    await categoryCommand({ _: ['lo'], action: 'rm', rid: resource.rid });

    const repo2 = new Repository(ctx.tempDir);
    await repo2.init();
    const status = await repo2.staging.getStatus();
    await repo2.close();

    const stagedMeta = status.metadata.find(m => m.rid === resource.rid);
    expect(stagedMeta).toBeDefined();
    expect(stagedMeta.category).toBe('');
  });

  test('should list categories for a resource', async () => {
    const repo = new Repository(ctx.tempDir);
    await repo.init();
    await createTestFile(path.join(ctx.tempDir, 'test.md'), '# Test');
    const resource = await repo.importFile(path.join(ctx.tempDir, 'test.md'));
    await repo.close();

    await expect(categoryCommand({
      _: ['lo'],
      action: 'list',
      rid: resource.rid
    })).resolves.toBeUndefined();
  });
});
