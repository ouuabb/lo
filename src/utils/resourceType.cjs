const path = require('path');

const TYPE_MAP = {
  '.md': 'note',
  '.pdf': 'pdf',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.svg': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.html': 'html',
  '.htm': 'html',
  '.txt': 'text',
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.csv': 'csv',
  '.xml': 'xml',
  '.doc': 'document',
  '.docx': 'document',
  '.xls': 'spreadsheet',
  '.xlsx': 'spreadsheet',
  '.ppt': 'presentation',
  '.pptx': 'presentation',
};

class ResourceType {
  static fromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return TYPE_MAP[ext] || 'unknown';
  }

  static isSupported(filePath) {
    return TYPE_MAP[path.extname(filePath).toLowerCase()] !== undefined;
  }

  static getExtensions(type) {
    return Object.entries(TYPE_MAP)
      .filter(([_, t]) => t === type)
      .map(([ext]) => ext);
  }
}

module.exports = ResourceType;