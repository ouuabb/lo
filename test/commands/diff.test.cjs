/**
 * diff 命令测试（新架构）
 *
 * diff 命令对比 staging 与资源库状态，新架构下通过 argv._[1] 获取路径。
 */

const path = require('path');
const { setupTempRepo, teardownTempRepo, createTestFile, Repository } = require('./commandTestHelper.cjs');
const diffCommand = require('../../src/commands/diff.cjs');
const addCommand = require('../../src/commands/add.cjs');

describe('diff command', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await setupTempRepo();
  });

  afterEach(async () => {
    await teardownTempRepo(ctx);
  });

  test('should show diff for a staged file', async () => {
    // 创建文件并暂存
    await createTestFile(path.join(ctx.tempDir, 'test.md'), '# Test\n\nContent\n');
    await addCommand({ _: ['lo', 'test.md'] });

    // diff 应该不报错（新架构直接输出到 console）
    await expect(diffCommand({ _: ['lo', 'test.md'] })).resolves.toBeUndefined();
  });

  test('should show diff for all files', async () => {
    await createTestFile(path.join(ctx.tempDir, 'test.md'), '# Test');
    await addCommand({ _: ['lo', 'test.md'] });

    await expect(diffCommand({ _: ['lo'] })).resolves.toBeUndefined();
  });
});
