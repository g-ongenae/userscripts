// Test the userscript version check against throwaway Git repositories.
//
//     npm test

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { compareVersions, main, problems, versionOf } from './check-userscript-versions.mjs';

function script(version, body = 'run();') {
  return `// ==UserScript==\n// @name         Demo\n// @version      ${version}\n// ==/UserScript==\n${body}\n`;
}

describe('userscript versions', () => {
  let root;

  const git = (...args) => {
    const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false'];
    execFileSync('git', [...identity, ...args], { cwd: root, stdio: 'ignore' });
  };
  const write = (name, source) => writeFileSync(join(root, 'userscripts', 'demo', name), source);
  const commit = (message) => {
    git('add', '--all');
    git('commit', '--quiet', '--message', message);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'userscript-versions-'));
    mkdirSync(join(root, 'userscripts', 'demo'), { recursive: true });
    git('init', '--quiet', '--initial-branch=main');
    write('demo.user.js', script('1.9.3'));
    commit('first');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('orders versions part by part', () => {
    assert.ok(compareVersions('1.10.0', '1.9.3') > 0);
    assert.equal(compareVersions('1.2', '1.2.0'), 0);
    assert.ok(compareVersions('2.0', '1.99.99') > 0);
  });

  it('only reads the version from the header', () => {
    assert.equal(versionOf(script('1.2.3')), '1.2.3');
    assert.equal(versionOf('// ==UserScript==\n// ==/UserScript==\n// @version      9.9.9\n'), null);
  });

  it('reports a change without a higher version', () => {
    write('demo.user.js', script('1.9.3', 'changed();'));
    assert.deepEqual(problems('main', null, root), [
      'userscripts/demo/demo.user.js: changed, but @version is still 1.9.3 (was 1.9.3)',
    ]);
    write('demo.user.js', script('1.9.2', 'changed();'));
    assert.equal(problems('main', null, root).length, 1);
  });

  it('passes a change with a higher version', () => {
    write('demo.user.js', script('1.10.0', 'changed();'));
    assert.deepEqual(problems('main', null, root), []);
  });

  it('does not check new and untouched scripts', () => {
    write('other.user.js', script('0.1.0'));
    git('add', '--all');
    assert.deepEqual(problems('main', null, root), []);
  });

  it('compares two commits from their merge base', (t) => {
    git('switch', '--quiet', '--create', 'topic');
    write('demo.user.js', script('1.9.3', 'changed();'));
    commit('edit without a bump');
    assert.equal(problems('main', 'topic', root).length, 1);
    write('demo.user.js', script('1.9.4', 'changed();'));
    commit('bump');
    assert.deepEqual(problems('main', 'topic', root), []);
    t.mock.method(console, 'log', () => {});
    assert.equal(main(['main', 'topic'], root), 0);
  });

  it('treats an unknown base as an error', (t) => {
    const error = t.mock.method(console, 'error', () => {});
    assert.equal(main(['no-such-ref'], root), 2);
    assert.match(error.mock.calls[0].arguments[0], /no-such-ref/);
  });
});
