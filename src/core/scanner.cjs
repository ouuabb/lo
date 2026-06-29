const glob = require('glob');
const fs = require('fs-extra');
const Note = require('./note.cjs');
const StringUtils = require('../utils/string.cjs');
const config = require('../config/default.cjs');

class Scanner {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
  }

  scan(options = {}) {
    const {
      status = null,
      tag = null,
      category = null,
      limit = null
    } = options;

    const allDirs = config.getAllDirectories();
    const patterns = allDirs.map(d => `${d}/**/*.md`);
    const ignore = ['**/node_modules/**', '**/.git/**'];

    const files = glob.sync(`{${patterns.join(',')}}`, {
      cwd: this.rootDir,
      ignore: ignore,
      absolute: true
    });

    let notes = files
      .map(file => {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          return new Note(file, content);
        } catch {
          return null;
        }
      })
      .filter(note => note !== null);

    if (status) {
      notes = notes.filter(note => note.data.status === status);
    }

    if (tag) {
      notes = notes.filter(note =>
        note.data.tags && note.data.tags.includes(tag)
      );
    }

    if (category) {
      notes = notes.filter(note =>
        note.data.category === category
      );
    }

    notes.sort((a, b) => {
      return new Date(b.data.created) - new Date(a.data.created);
    });

    if (limit) {
      notes = notes.slice(0, limit);
    }

    return notes;
  }

  getStats() {
    const notes = this.scan();

    const tags = new Map();
    const statuses = new Map();
    let totalWords = 0;

    notes.forEach(note => {
      if (note.data.tags) {
        note.data.tags.forEach(tag => {
          tags.set(tag, (tags.get(tag) || 0) + 1);
        });
      }

      const status = note.data.status || 'draft';
      statuses.set(status, (statuses.get(status) || 0) + 1);

      totalWords += StringUtils.countWords(note.content);
    });

    return {
      total: notes.length,
      active: notes.length,
      tags: Object.fromEntries(tags),
      statuses: Object.fromEntries(statuses),
      totalWords: totalWords
    };
  }
}

module.exports = Scanner;