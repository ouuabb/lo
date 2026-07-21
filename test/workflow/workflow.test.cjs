const fs = require('fs-extra');
const path = require('path');
const Workflow = require('../../src/workflow/workflow.cjs');
const WorkflowEngine = require('../../src/workflow/workflowEngine.cjs');
const WorkflowRegistry = require('../../src/workflow/workflowRegistry.cjs');
const Database = require('../../src/repo/database.cjs');
const WorkflowStep = require('../../src/workflow/workflowStep.cjs');

describe('Workflow', () => {
  test('should create workflow with id', () => {
    const workflow = new Workflow({ 
      id: 'test-workflow', 
      name: 'Test Workflow',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    
    expect(workflow.id).toBe('test-workflow');
    expect(workflow.name).toBe('Test Workflow');
    expect(workflow.status).toBe('active');
  });

  test('should throw error without id', () => {
    expect(() => new Workflow({ name: 'Test' })).toThrow('Workflow must have an id');
  });

  test('should use id as name when name not provided', () => {
    const workflow = new Workflow({ 
      id: 'test-id',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    expect(workflow.name).toBe('test-id');
  });

  test('should have empty description by default', () => {
    const workflow = new Workflow({ 
      id: 'test',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    expect(workflow.description).toBe('');
  });

  test('should have manual trigger by default', () => {
    const workflow = new Workflow({ 
      id: 'test',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    expect(workflow.trigger.type).toBe('manual');
  });

  test('should serialize to JSON', () => {
    const workflow = new Workflow({ 
      id: 'test', 
      name: 'Test', 
      description: 'Desc',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    const json = workflow.toJSON();
    
    expect(json.id).toBe('test');
    expect(json.name).toBe('Test');
    expect(json.description).toBe('Desc');
    expect(json.status).toBe('active');
  });

  test('should validate workflow with steps', () => {
    const workflow = new Workflow({ 
      id: 'test',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    const errors = workflow.validate();
    expect(errors.length).toBe(0);
  });

  test('should validate workflow without steps', () => {
    const workflow = new Workflow({ id: 'test' });
    const errors = workflow.validate();
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('at least one step');
  });
});

describe('WorkflowEngine', () => {
  let tempDir;
  let db;
  let registry;
  let engine;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-workflow-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
    db = new Database(tempDir);
    await db.init();
    registry = new WorkflowRegistry(db);
    engine = new WorkflowEngine({
      db,
      registry,
      stepExecutor: { execute: async () => ({}) },
      conditionEngine: { evaluate: () => true }
    });
  });

  afterEach(async () => {
    if (db) await db.close();
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should register workflow', async () => {
    const workflow = new Workflow({ 
      id: 'test-workflow', 
      name: 'Test Workflow',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    
    await engine.register(workflow);
    
    const registered = registry.get('test-workflow');
    expect(registered).not.toBeNull();
    expect(registered.name).toBe('Test Workflow');
  });

  test('should list workflows', async () => {
    await registry.register(new Workflow({ 
      id: 'wf-1', 
      name: 'Workflow 1',
      steps: [{ id: 'step1', type: 'operation' }]
    }));
    await registry.register(new Workflow({ 
      id: 'wf-2', 
      name: 'Workflow 2',
      steps: [{ id: 'step1', type: 'operation' }]
    }));

    const workflows = registry.list();
    expect(workflows.length).toBe(2);
  });

  test('should get workflow by ID', async () => {
    const workflow = new Workflow({ 
      id: 'my-workflow', 
      name: 'My Workflow',
      steps: [{ id: 'step1', type: 'operation' }]
    });
    await registry.register(workflow);

    const retrieved = registry.get('my-workflow');
    expect(retrieved).not.toBeNull();
    expect(retrieved.name).toBe('My Workflow');
  });

  test('should return null for unknown workflow', () => {
    const workflow = registry.get('unknown-workflow');
    expect(workflow).toBeNull();
  });
});