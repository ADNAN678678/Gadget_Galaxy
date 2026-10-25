'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const lock = require('../package-lock.json');

test('body-parser is locked to a patched (2.x) version', () => {
  // GHSA-27r3-jxmh-p828 (denial of service via URL-encoded bodies) is fixed
  // in body-parser 2.0.1+. Every resolved body-parser instance in the lockfile
  // must therefore be 2.x; a lingering 1.20.3 means the vulnerable version is
  // still in the dependency tree.
  const entries = Object.keys(lock.packages).filter(
    (key) => key === 'node_modules/body-parser' || key.endsWith('/body-parser')
  );

  assert.ok(entries.length > 0, 'body-parser should be present in the lockfile');

  for (const key of entries) {
    const version = lock.packages[key].version;
    const major = Number(version.split('.')[0]);
    assert.ok(
      major >= 2,
      `expected body-parser 2.x in lockfile, found ${version} at ${key}`
    );
  }
});
