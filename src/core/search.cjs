const Fuse = require('fuse.js');
const Scanner = require('./scanner.cjs');

class SearchEngine {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.scanner = new Scanner(rootDir);
  }
  
  search(query, options = {}) {
    const notes = this.scanner.scan({ includeArchived: true });
    
    const searchable = notes.map(note => ({
      ...note.toJSON(),
      fullContent: note.content,
      searchText: `${note.data.title} ${note.content} ${(note.data.tags || []).join(' ')}`
    }));
    
    const fuseOptions = {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'searchText', weight: 0.3 },
        { name: 'tags', weight: 0.2 },
        { name: 'fullContent', weight: 0.1 }
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true
    };
    
    const fuse = new Fuse(searchable, fuseOptions);
    const results = fuse.search(query);
    
    return results
      .slice(0, options.limit || 20)
      .map(result => ({
        ...result.item,
        score: result.score,
        matches: result.matches
      }));
  }
  
  searchByTag(tag) {
    const notes = this.scanner.scan({ includeArchived: true });
    return notes
      .filter(note => note.data.tags && note.data.tags.includes(tag))
      .map(note => note.toJSON());
  }
  
  searchByCategory(category) {
    const notes = this.scanner.scan({ includeArchived: true });
    return notes
      .filter(note => note.data.category === category)
      .map(note => note.toJSON());
  }
  
  searchByDateRange(startDate, endDate) {
    const notes = this.scanner.scan({ includeArchived: true });
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return notes
      .filter(note => {
        const created = new Date(note.data.created);
        return created >= start && created <= end;
      })
      .map(note => note.toJSON());
  }
  
  getAllTags() {
    const notes = this.scanner.scan({ includeArchived: true });
    const tagMap = new Map();
    
    notes.forEach(note => {
      if (note.data.tags) {
        note.data.tags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      }
    });
    
    return Object.fromEntries(
      Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1])
    );
  }
}

module.exports = SearchEngine;