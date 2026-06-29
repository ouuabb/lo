const matter = require('gray-matter');
const fs = require('fs-extra');
const DateUtils = require('../utils/date.cjs');
const StringUtils = require('../utils/string.cjs');
const FileUtils = require('../utils/file.cjs');
const config = require('../config/default.cjs');

class Note {
  constructor(filePath, content = '') {
    this.filePath = filePath;
    this.parsed = matter(content);
    this.data = this.parsed.data;
    this.content = this.parsed.content;
    
    if (!this.data.title) {
      this.data.title = this.guessTitle();
    }
    if (!this.data.created) {
      this.data.created = DateUtils.today();
    }
  }
  
  guessTitle() {
    const basename = FileUtils.getBasename(this.filePath);
    return basename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  }
  
  static generateFilename(title) {
    const slug = StringUtils.slugify(title);
    const date = DateUtils.today();
    return `${date}-${slug}.md`;
  }
  
  static async create(title, options = {}) {
    const { tags = [], template = 'default', category = null } = options;
    
    const frontmatter = {
      ...config.frontmatter.defaults,
      title: title,
      created: DateUtils.today(),
      tags: tags,
      status: 'draft'
    };
    
    if (category) {
      frontmatter.category = category;
    }
    
    const templateContent = await this.loadTemplate(template);
    const content = templateContent.replace('{{title}}', title);
    
    const fullContent = matter.stringify(content, frontmatter);
    
    const filename = this.generateFilename(title);
    const filePath = FileUtils.join(config.getDefaultDir(), filename);
    
    await FileUtils.write(filePath, fullContent);
    
    return new Note(filePath, fullContent);
  }
  
  static async loadTemplate(name) {
    const templatePath = FileUtils.join(
      process.cwd(), 
      'templates', 
      `${name}.md.template`
    );
    
    try {
      return await FileUtils.read(templatePath);
    } catch {
      return `# {{title}}\n\n开始写作...\n`;
    }
  }
  
  async update(content) {
    this.parsed = matter(content);
    this.data = this.parsed.data;
    this.content = this.parsed.content;
    await FileUtils.write(this.filePath, content);
  }
  
  addTag(tag) {
    if (!this.data.tags) {
      this.data.tags = [];
    }
    if (!this.data.tags.includes(tag)) {
      this.data.tags.push(tag);
      this.save();
    }
  }
  
  removeTag(tag) {
    if (this.data.tags) {
      this.data.tags = this.data.tags.filter(t => t !== tag);
      this.save();
    }
  }
  
  setCategory(category) {
    this.data.category = category;
    this.save();
  }
  
  removeCategory() {
    delete this.data.category;
    this.save();
  }
  
  async save() {
    const content = matter.stringify(this.content, this.data);
    await FileUtils.write(this.filePath, content);
  }
  
  toJSON() {
    return {
      path: this.filePath,
      title: this.data.title,
      created: this.data.created,
      category: this.data.category || null,
      tags: this.data.tags || [],
      status: this.data.status || 'draft',
      wordCount: StringUtils.countWords(this.content),
      links: StringUtils.extractLinks(this.content),
      todos: StringUtils.extractTodos(this.content)
    };
  }
  
  static fromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return new Note(filePath, content);
  }
}

module.exports = Note;