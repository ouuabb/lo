const fs = require('fs-extra');
const path = require('path');
const Note = require('../../src/core/note.cjs');

describe('Note', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-note-'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should create note with content', () => {
    const filePath = path.join(tempDir, 'test.md');
    const content = '# Title\n\n**bold** text';
    const note = new Note(filePath, content);

    expect(note.title).toBe('Title');
    expect(note.content).toBe(content);
    expect(note.filePath).toBe(filePath);
    expect(note.created).toBeDefined();
  });

  test('should extract title from first line', () => {
    const filePath = path.join(tempDir, 'test.md');
    const content = '# My Title\n\nBody text';
    const note = new Note(filePath, content);
    expect(note.title).toBe('My Title');
  });

  test('should guess title from filename', () => {
    const filePath = path.join(tempDir, '2024-01-01-my-note.md');
    const content = 'No heading here';
    const note = new Note(filePath, content);
    expect(note.title).toBe('my-note');
  });

  test('should generate filename', () => {
    const filename = Note.generateFilename('My Note');
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-.*\.md$/);
  });

  test('should serialize to JSON', () => {
    const filePath = path.join(tempDir, 'test.md');
    const content = '# Title\n\nContent';
    const note = new Note(filePath, content);

    const json = note.toJSON();
    expect(json.path).toBe(filePath);
    expect(json.title).toBe('Title');
    expect(json.created).toBeDefined();
    expect(json.wordCount).toBeDefined();
    expect(json.links).toBeDefined();
    expect(json.todos).toBeDefined();
  });

  test('should create note from file', async () => {
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '# File Note\n\nContent from file');

    const note = Note.fromFile(filePath);
    expect(note.title).toBe('File Note');
    expect(note.content).toBe('# File Note\n\nContent from file');
    expect(note.filePath).toBe(filePath);
  });
});