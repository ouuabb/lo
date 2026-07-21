const fs = require('fs-extra');
const path = require('path');
const tagCommand = require('../../src/commands/tag.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('tag command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-tag-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should add tag to resource', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    const resource = await repo.createResource('note', '# Note\n\nContent');
    await repo.close();

    const result = await tagCommand.run(tempDir, { action: 'add', rid: resource.rid, tags: ['tag1'] });
    expect(result).not.toBeNull();
    expect(result.tags).toContain('tag1');
  });

  test('should remove tag from resource', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    const resource = await repo.createResource('note', '# Note', { metadata: { tags: ['tag1', 'tag2'] } });
    await repo.close();

    await tagCommand.run(tempDir, { action: 'remove', rid: resource.rid, tags: ['tag1'] });

    const repo2 = new Repository(tempDir);
    await repo2.open({ skipAuth: true });
    const updated = await repo2.getResource(resource.rid);
    await repo2.close();

    expect(updated.metadata.tags).toEqual(['tag2']);
  });

  test('should list tags', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    await repo.createResource('note', '# Note 1', { metadata: { tags: ['tag1', 'tag2'] } });
    await repo.createResource('note', '# Note 2', { metadata: { tags: ['tag1', 'tag3'] } });
    await repo.close();

    const result = await tagCommand.run(tempDir, { action: 'list' });
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  test('should find resources by tag', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    await repo.createResource('note', '# Note 1', { metadata: { tags: ['tag1'] } });
    await repo.createResource('note', '# Note 2', { metadata: { tags: ['tag2'] } });
    await repo.close();

    const result = await tagCommand.run(tempDir, { action: 'find', tag: 'tag1' });
    expect(result.length).toBe(1);
  });
});