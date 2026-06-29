const fs = require('fs-extra');
const path = require('path');
const Scanner = require('./scanner.cjs');
const config = require('../config/default.cjs');

class Indexer {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.scanner = new Scanner(rootDir);
  }

  async generate() {
    const notes = this.scanner.scan();
    const stats = this.scanner.getStats();

    let content = [];

    content.push('# 知识库索引');
    content.push(`\n> 最后更新: ${new Date().toLocaleString()}`);
    content.push(`> 总笔记: ${stats.total} 篇 | 字数: ${stats.totalWords}`);
    content.push(`> 根目录: ${config.ROOT_DIR}/`);
    content.push('\n---\n');

    content.push('## 最近更新');
    content.push('');
    const recent = notes.slice(0, config.index.maxRecentNotes);
    recent.forEach(note => {
      const title = note.data.title || '未命名';
      content.push(`- [${title}](${note.filePath})`);
    });
    content.push('');

    if (config.index.showTagsCloud) {
      content.push('## 标签');
      content.push('');
      const tagList = Object.entries(stats.tags)
        .sort((a, b) => b[1] - a[1]);

      const tagCloud = tagList.map(([tag, count]) =>
        `[${tag}](#tag-${tag}) (${count})`
      ).join(' · ');
      content.push(tagCloud);
      content.push('');

      content.push('### 按标签分类');
      content.push('');
      tagList.forEach(([tag, count]) => {
        content.push(`<a id="tag-${tag}"></a>`);
        content.push(`#### #${tag} (${count}篇)`);
        content.push('');
        const taggedNotes = notes.filter(n =>
          n.data.tags && n.data.tags.includes(tag)
        );
        taggedNotes.forEach(note => {
          content.push(`- [${note.data.title || '未命名'}](${note.filePath})`);
        });
        content.push('');
      });
    }

    content.push('## 按状态分类');
    content.push('');
    const statusMap = {
      draft: '草稿',
      published: '已发布',
      archived: '已归档'
    };

    Object.entries(stats.statuses).forEach(([status, count]) => {
      const label = statusMap[status] || status;
      content.push(`- ${label}: ${count}篇`);
    });

    content.push('\n## 统计');
    content.push('');
    content.push(`- 总笔记数: ${stats.total}`);
    content.push(`- 总字数: ${stats.totalWords}`);
    content.push(`- 总标签数: ${Object.keys(stats.tags).length}`);
    content.push(`- 根目录: ${config.ROOT_DIR}/`);
    const catList = Object.entries(config.directories);
    if (catList.length > 0) {
      content.push(`- 子分类: ${catList.map(([k, v]) => `${k}(${v})`).join(', ')}`);
    }

    const indexPath = path.join(this.rootDir, config.index.filename);
    await fs.writeFile(indexPath, content.join('\n'));

    return indexPath;
  }
}

module.exports = Indexer;
