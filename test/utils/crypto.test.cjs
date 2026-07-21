const fs = require('fs-extra');
const path = require('path');
const CryptoUtils = require('../../src/utils/crypto.cjs');

describe('CryptoUtils', () => {
  test('should generate key', () => {
    const key = CryptoUtils.generateKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  test('should encrypt and decrypt buffer', () => {
    const key = CryptoUtils.generateKey();
    const original = Buffer.from('test content');
    
    const encrypted = CryptoUtils.encryptFile(original, key);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.length).toBeGreaterThan(original.length);
    
    const decrypted = CryptoUtils.decryptFile(encrypted, key);
    expect(decrypted.toString()).toBe('test content');
  });

  test('should detect encrypted file', async () => {
    const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-crypto-'));
    
    const key = CryptoUtils.generateKey();
    const filePath = path.join(tempDir, 'encrypted.dat');
    await fs.writeFile(filePath, CryptoUtils.encryptFile(Buffer.from('test'), key));
    
    const raw = await fs.readFile(filePath);
    expect(raw.length >= 4 && raw.subarray(0, 4).equals(CryptoUtils.MAGIC)).toBe(true);
    
    await fs.remove(tempDir);
  });

  test('should encrypt and decrypt file', async () => {
    const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-crypto-file-'));
    
    const key = CryptoUtils.generateKey();
    const inputPath = path.join(tempDir, 'input.txt');
    const outputPath = path.join(tempDir, 'encrypted.dat');
    const decryptedPath = path.join(tempDir, 'decrypted.txt');
    
    await fs.writeFile(inputPath, 'test content for file encryption');
    const plaintext = await fs.readFile(inputPath);
    
    CryptoUtils.writeEncryptedFile(outputPath, plaintext, key);
    
    const encryptedContent = await fs.readFile(outputPath);
    expect(encryptedContent.length).toBeGreaterThan(plaintext.length);
    
    const decrypted = CryptoUtils.readEncryptedFile(outputPath, key);
    expect(decrypted.toString()).toBe('test content for file encryption');
    
    await fs.remove(tempDir);
  });

  test('should init and load repo key', async () => {
    const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-repo-key-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
    
    const { repoKey, keyFilePath } = CryptoUtils.initRepoKey(tempDir);
    
    expect(repoKey).toBeInstanceOf(Buffer);
    expect(repoKey.length).toBe(32);
    expect(keyFilePath).toContain('repo.key');
    
    const loadedKey = CryptoUtils.loadRepoKey(tempDir);
    expect(loadedKey).toBeInstanceOf(Buffer);
    expect(loadedKey.length).toBe(32);
    
    await fs.remove(tempDir);
  });

  test('should return null for missing repo key', async () => {
    const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-missing-key-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
    
    const loadedKey = CryptoUtils.loadRepoKey(tempDir);
    expect(loadedKey).toBeNull();
    
    await fs.remove(tempDir);
  });

  test('should check if encryption is enabled', async () => {
    const tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-encryption-check-'));
    
    const key = CryptoUtils.generateKey();
    const encryptedPath = path.join(tempDir, 'encrypted.dat');
    const plainPath = path.join(tempDir, 'plain.txt');
    
    await fs.writeFile(encryptedPath, CryptoUtils.encryptFile(Buffer.from('secret'), key));
    await fs.writeFile(plainPath, 'not encrypted');
    
    expect(CryptoUtils.isEncryptedFile(encryptedPath)).toBe(true);
    expect(CryptoUtils.isEncryptedFile(plainPath)).toBe(false);
    expect(CryptoUtils.isEncryptedFile('/nonexistent/path')).toBe(false);
    
    await fs.remove(tempDir);
  });
});