const fs = require('fs-extra');
const path = require('path');

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('uuid', () => {
  let mockUuidCounter = 0;
  return {
    v4: jest.fn(() => `test-uuid-${++mockUuidCounter}`)
  };
});

jest.spyOn(process, 'exit').mockImplementation(() => {});

beforeEach(async () => {
});

afterEach(async () => {
});

global.testUtils = {
  async createTempRepo() {
    const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-'));
    const repoDir = path.join(tempDir, '.repo');
    await fs.ensureDir(repoDir);
    return tempDir;
  },

  async cleanupTempDir(dir) {
    if (dir && await fs.pathExists(dir)) {
      await fs.remove(dir);
    }
  },

  async createTestFile(dir, filename, content) {
    const filePath = path.join(dir, filename);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    return filePath;
  }
};