const crypto = require('crypto');
const fs = require('fs-extra');

class HashUtils {
  static async fromFile(filePath) {
    const content = await fs.readFile(filePath);
    return this.fromBuffer(content);
  }

  static fromBuffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  static fromString(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}

module.exports = HashUtils;