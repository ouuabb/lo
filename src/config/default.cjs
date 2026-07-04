const fs = require('fs-extra');
const path = require('path');

// docs 是笔记的硬编码根目录，不可变
const ROOT_DIR = 'docs';

const defaults = {
  directories: {},
  naming: {
    pattern: 'YYYY-MM-DD-{slug}.md',
    datePrefix: true
  },
  index: {
    filename: 'README.md',
    maxRecentNotes: 20,
    showTagsCloud: true
  },
  editor: process.env.EDITOR || 'notepad',
  archive: {
    enabled: false,
    olderThanDays: 365
  }
};

let userConfig = {};
try {
  const configPath = path.join(process.cwd(), '.note', 'config.json');
  if (fs.existsSync(configPath)) {
    userConfig = fs.readJsonSync(configPath);
  }
} catch (e) { /* 使用默认配置 */ }

const merged = { ...defaults, ...userConfig };

// 根目录（不可变）
merged.ROOT_DIR = ROOT_DIR;

// 获取根目录路径
merged.getRootDir = function () {
  return this.ROOT_DIR;
};

// 获取默认存放目录（docs/）
merged.getDefaultDir = function () {
  return this.ROOT_DIR;
};

// 根据分类 key 获取 docs 下的子目录路径
merged.getCategoryDir = function (category) {
  if (!category) return this.getDefaultDir();
  const sub = this.directories[category];
  if (!sub) return null;
  return path.join(this.ROOT_DIR, sub);
};

// 获取所有扫描目录（docs 及其子目录）
merged.getAllDirectories = function () {
  const dirs = [this.ROOT_DIR];
  for (const sub of Object.values(this.directories)) {
    dirs.push(path.join(this.ROOT_DIR, sub));
  }
  return dirs;
};

module.exports = merged;