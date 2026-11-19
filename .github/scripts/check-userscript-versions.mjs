#!/usr/bin/env node
// Fail when a userscript changed without a higher `@version`.
//
//     node .github/scripts/check-userscript-versions.mjs BASE         # working tree against BASE
//     node .github/scripts/check-userscript-versions.mjs BASE HEAD    # commit HEAD against BASE
//
// Violentmonkey and Greasy Fork only pick up a new copy of a script when its
// `@version` grows, so an edit published under the old number never reaches the
// browsers that already installed it. Every file of `userscripts/` that differs
// from the merge base of BASE and HEAD must therefore carry a higher `@version`
// than it had there. New scripts are not checked.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
// In a Git pathspec, `*` also matches `/`: this covers userscripts/<website>/<name>.user.js.
const PATTERN = 'userscripts/*.user.js';
const VERSION = /^\/\/ @version[ \t]+(\S+)/m;

class GitError extends Error {}

function git(root, ...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    throw new GitError(String(error.stderr ?? error.message).trim());
  }
}

/** Return the `@version` of a userscript, or null when its header has none. */
export function versionOf(source) {
  const header = source.split('==/UserScript==', 1)[0];
  return header.match(VERSION)?.[1] ?? null;
}

/** Split a version into [number, suffix] parts, without the trailing zero parts. */
function versionKey(version) {
  const key = version.split('.').map((part) => {
    const [, digits, rest] = part.match(/^(\d*)(.*)$/s);
    return [Number(digits || 0), rest];
  });
  while (key.length && key.at(-1)[0] === 0 && key.at(-1)[1] === '') {
    key.pop();
  }
  return key;
}

/**
 * Order versions part by part: 1.10.0 is above 1.9.3, and 1.2 equals 1.2.0.
 * Return a negative number when `a` is lower than `b`, 0 when they are equal and a positive one otherwise.
 */
export function compareVersions(a, b) {
  const [left, right] = [versionKey(a), versionKey(b)];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const [[leftNumber, leftRest], [rightNumber, rightRest]] = [left[i], right[i]];
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    if (leftRest !== rightRest) return leftRest < rightRest ? -1 : 1;
  }
  return left.length - right.length;
}

/** List the userscripts changed since `base` whose `@version` did not grow. */
export function problems(base, head = null, root = ROOT) {
  const start = git(root, 'merge-base', base, head ?? 'HEAD').trim();
  const revisions = head ? [start, head] : [start];
  const changed = git(root, 'diff', '--name-only', '--no-renames', '--diff-filter=M', ...revisions, '--', PATTERN)
    .split('\n')
    .filter(Boolean);
  const found = [];
  for (const path of changed) {
    const oldVersion = versionOf(git(root, 'show', `${start}:${path}`));
    const newVersion = versionOf(head ? git(root, 'show', `${head}:${path}`) : readFileSync(join(root, path), 'utf8'));
    if (newVersion === null) {
      found.push(`${path}: no @version in its header`);
    } else if (oldVersion !== null && compareVersions(newVersion, oldVersion) <= 0) {
      found.push(`${path}: changed, but @version is still ${newVersion} (was ${oldVersion})`);
    }
  }
  return found;
}

export function main(argv, root = ROOT) {
  if (argv.length < 1 || argv.length > 2) {
    console.error('Usage: node .github/scripts/check-userscript-versions.mjs BASE [HEAD]');
    return 2;
  }
  let found;
  try {
    found = problems(argv[0], argv[1] ?? null, root);
  } catch (error) {
    if (!(error instanceof GitError)) throw error;
    console.error(`check-userscript-versions.mjs: ${error.message}`);
    return 2;
  }
  for (const problem of found) {
    console.error(problem);
  }
  if (found.length) {
    console.error('Raise the @version of each userscript listed above.');
    return 1;
  }
  console.log('Every changed userscript has a higher @version.');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
