const fs = require('fs-extra');
const path = require('path');
const addCommand = require('../../src/commands/add.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('add command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-add-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should add file to staging', async () => {
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '# Test\n\nContent');

    const result = await addCommand.run(tempDir, { files: ['test.md'] });
    expect(result).not.toBeNull();
    expect(result.added.length).toBe(1);
    expect(result.added[0]).toBe('test.md');
  });

  test('should add multiple files', async () => {
    await fs.writeFile(path.join(tempDir, 'file1.md'), '# File 1');
    await fs.writeFile(path.join(tempDir, 'file2.md'), '# File 2');

    const result = await addCommand.run(tempDir, { files: ['file1.md', 'file2.md'] });
    expect(result.added.length).toBe(2);
  });

  test('should add all files', async () => {
    await fs.writeFile(path.join(tempDir, 'file1.md'), '# File 1');
    await fs.writeFile(path.join(tempDir, 'file2.md'), '# File 2');

    const result = await addCommand.run(tempDir, { all: true });
    expect(result.added.length).toBe(2);
  });

  test('should handle non-existent file', async () => {
    await expect(addCommand.run(tempDir, { files: ['nonexistent.md'] })).rejects.toThrow();
  });
});