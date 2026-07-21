const fs = require('fs-extra');
const path = require('path');
const GraphQuery = require('../../src/domain/graphQuery.cjs');
const Database = require('../../src/repo/database.cjs');

describe('GraphQuery', () => {
  let tempDir;
  let db;
  let graphQuery;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-graph-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
    db = new Database(tempDir);
    await db.init();
    graphQuery = new GraphQuery(db);
  });

  afterEach(async () => {
    if (db) await db.close();
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should find direct neighbors', async () => {
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_c', 'reference']);

    const neighbors = await graphQuery.findNeighbors('res_a');
    expect(neighbors.length).toBe(2);
    const rids = neighbors.map(n => n.rid);
    expect(rids).toContain('res_b');
    expect(rids).toContain('res_c');
  });

  test('should find neighbors with type filter', async () => {
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_c', 'wikilink']);

    const refs = await graphQuery.findNeighbors('res_a', { type: 'reference' });
    expect(refs.length).toBe(1);
    expect(refs[0].rid).toBe('res_b');
  });

  test('should find paths between resources', async () => {
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_b', 'res_c', 'reference']);

    const paths = await graphQuery.findPaths('res_a', 'res_c');
    expect(paths.length).toBeGreaterThan(0);
  });

  test('should calculate degree', async () => {
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_c', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_d', 'res_a', 'reference']);

    const degree = await graphQuery.calculateDegree('res_a');
    expect(degree.in).toBe(1);
    expect(degree.out).toBe(2);
    expect(degree.total).toBe(3);
  });

  test('should get reachable resources', async () => {
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_b', 'res_c', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_c', 'res_d', 'reference']);

    const reachable = await graphQuery.getReachable('res_a', 2);
    expect(reachable.length).toBe(2);
    const rids = reachable.map(r => r.rid);
    expect(rids).toContain('res_b');
    expect(rids).toContain('res_c');
  });

  test('should find cycles', async () => {
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_b', 'res_c', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_c', 'res_a', 'reference']);

    const cycles = await graphQuery.findCycles('res_a');
    expect(cycles.length).toBeGreaterThan(0);
  });

  test('should build adjacency list', async () => {
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_c', 'reference']);

    const adjacency = await graphQuery.buildAdjacencyList();
    expect(adjacency['res_a']).toBeDefined();
    expect(adjacency['res_a'].length).toBe(2);
  });

  test('should find isolated resources', async () => {
    await db.exec('INSERT INTO resources (rid, name, type) VALUES (?, ?, ?)', ['res_a', 'A', 'note']);
    await db.exec('INSERT INTO resources (rid, name, type) VALUES (?, ?, ?)', ['res_b', 'B', 'note']);
    await db.exec('INSERT INTO resources (rid, name, type) VALUES (?, ?, ?)', ['res_c', 'C', 'note']);
    await db.exec('INSERT INTO relations (from_rid, to_rid, type) VALUES (?, ?, ?)', ['res_a', 'res_b', 'reference']);

    const isolated = await graphQuery.findIsolated();
    expect(isolated.length).toBe(1);
    expect(isolated[0].rid).toBe('res_c');
  });
});