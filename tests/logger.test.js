import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';

const require = createRequire(import.meta.url);
const { createLogger } = require('../lib/logger.cjs');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-logger-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// createLogger
// ============================================================

describe('createLogger', () => {
  it('creates log file on construction', () => {
    const logPath = path.join(tmpDir, 'test-create.log');
    createLogger(logPath);
    expect(fs.existsSync(logPath)).toBe(true);
  });

  it('clears file on construction', () => {
    const logPath = path.join(tmpDir, 'test-clear.log');
    fs.writeFileSync(logPath, 'pre-existing content\n');
    createLogger(logPath);
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toBe('');
  });

  it('log() writes timestamped lines to the file', () => {
    const logPath = path.join(tmpDir, 'test-write.log');
    const { log } = createLogger(logPath);
    log('hello', 'world');

    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toMatch(/^\[.+\] hello world\n$/);
    // ISO timestamp format
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
  });

  it('multiple log calls append to the file', () => {
    const logPath = path.join(tmpDir, 'test-append.log');
    const { log } = createLogger(logPath);
    log('first line');
    log('second line');

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('first line');
    expect(lines[1]).toContain('second line');
  });
});
