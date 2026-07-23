/**
 * rm 命令测试（新架构）
 *
 * rm 命令将文件暂存为删除状态（staging.remove），不直接删除数据库记录。
 */

const path = require('path');
const { setupTempRepo, teardownTempRepo, createTestFile, Repository } = require('./commandTestHelper.cjs');
const rmCommand = require('../../src/commands/rm.cjs');

describe('rm command', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await setupTempRepo();
  });

  afterEach(async () => {
    await teardownTempRepo(ctx);
  });

  test('should stage a file for removal', async () => {
    await createTestFile(path.join(ctx.tempDir, 'test.md'), '# Test');
    const repo = new Repository(ctx.tempDir);
    await repo.init();
    await repo.importFile(path.join(ctx.tempDir, 'test.md'));
    await repo.close();

    // rm 命令暂存删除
    await expect(rmCommand({ _: ['lo', 'test.md'] })).resolves.toBeUndefined();

    // 验证暂存区有删除记录
    const repo2 = new Repository(ctx.tempDir);
    await repo2.init();
    const status = await repo2.staging.getStatus();
    await repo2.close();

    expect(status.deleted).toContain('test.md');
  });
});
