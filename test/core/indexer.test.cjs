const fs = require('fs-extra');
const path = require('path');
const Indexer = require('../../src/core/indexer.cjs');

describe('Indexer', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-indexer-'));
    await fs.ensureDir(path.join(tempDir, 'docs'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should generate index from documents', async () => {
    await fs.writeFile(path.join(tempDir, 'docs', 'doc1.md'), '# Doc 1\n\ncontent');
    await fs.writeFile(path.join(tempDir, 'docs', 'doc2.md'), '# Doc 2\n\ncontent');

    const indexer = new Indexer(tempDir);
    const indexPath = await indexer.generate();

    expect(indexPath).toContain('README.md');
    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('知识库索引');
    expect(content).toContain('Doc 1');
    expect(content).toContain('Doc 2');
  });

  test('should include stats in index', async () => {
    await fs.writeFile(path.join(tempDir, 'docs', 'doc.md'), '# Title\n\nWord1 Word2 Word3');

    const indexer = new Indexer(tempDir);
    await indexer.generate();

    const content = await fs.readFile(path.join(tempDir, 'README.md'), 'utf-8');
    expect(content).toContain('总笔记');
    expect(content).toContain('字数');
  });

  test('should handle empty docs directory', async () => {
    const indexer = new Indexer(tempDir);
    const indexPath = await indexer.generate();

    expect(indexPath).toContain('README.md');
    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('知识库索引');
  });

  test('should limit recent notes', async () => {
    for (let i = 1; i <= 25; i++) {
      await fs.writeFile(path.join(tempDir, 'docs', `doc${i}.md`), `# Doc ${i}`);
    }

    const indexer = new Indexer(tempDir);
    await indexer.generate();

    const content = await fs.readFile(path.join(tempDir, 'README.md'), 'utf-8');
    const links = content.match(/-\s\[.*\]\(.*\)/g) || [];
    expect(links.length).toBeLessThanOrEqual(20);
  });
});