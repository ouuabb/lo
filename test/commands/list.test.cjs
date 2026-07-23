/**
 * list 命令测试（新架构）
 *
 * list 命令列出仓库中的资源，新架构下通过 console.log 输出。
 */

const path = require('path');
const { setupTempRepo, teardownTempRepo, createTestFile, Repository } = require('./commandTestHelper.cjs');
const listCommand = require('../../src/commands/list.cjs');

describe('list command', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await setupTempRepo();
  });

  afterEach(async () => {
    await teardownTempRepo(ctx);
  });

  test('should list resources', async () => {
    const repo = new Repository(ctx.tempDir);
    await repo.init();
    await createTestFile(path.join(ctx.tempDir, 'test1.md'), '# Note 1');
    await createTestFile(path.join(ctx.tempDir, 'test2.md'), '# Note 2');
    await repo.importFile(path.join(ctx.tempDir, 'test1.md'));
    await repo.importFile(path.join(ctx.tempDir, 'test2.md'));
    await repo.close();

    // 验证不抛异常，资源可通过 DB 验证
    await expect(listCommand({ _: ['lo'] })).resolves.toBeUndefined();

    const repo2 = new Repository(ctx.tempDir);
    await repo2.init();
    const resources = await repo2.getAllResources();
    await repo2.close();

    expect(resources.length).toBeGreaterThanOrEqual(2);
  });

  test('should handle empty repository', async () => {
    await expect(listCommand({ _: ['lo'] })).resolves.toBeUndefined();
  });

  test('should list with limit', async () => {
    const repo = new Repository(ctx.tempDir);
    await repo.init();
    await createTestFile(path.join(ctx.tempDir, 'a.md'), '# A');
    await createTestFile(path.join(ctx.tempDir, 'b.md'), '# B');
    await createTestFile(path.join(ctx.tempDir, 'c.md'), '# C');
    await repo.importFile(path.join(ctx.tempDir, 'a.md'));
    await repo.importFile(path.join(ctx.tempDir, 'b.md'));
    await repo.importFile(path.join(ctx.tempDir, 'c.md'));
    await repo.close();

    await expect(listCommand({ _: ['lo'], limit: 2 })).resolves.toBeUndefined();
  });
});
