import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const validator = path.resolve('scripts/validate-config.mjs')

function fixture(config, lockfile = 'package-lock.json') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xlate-preview-actions-'))
  fs.mkdirSync(path.join(root, '.xlate'))
  fs.writeFileSync(path.join(root, '.xlate', 'preview.json'), JSON.stringify(config))
  fs.writeFileSync(path.join(root, lockfile), '{}')
  return root
}

const valid = {
  name: 'Example',
  version: '1.0.0',
  native_generation: 'expo',
  ios: {
    identifier: 'com.example.app',
    workspace: 'ios/Example.xcworkspace',
    scheme: 'Example',
    configuration: 'Release',
  },
}

test('accepts a minimal public configuration without echoing it', () => {
  const root = fixture(valid)
  const output = execFileSync(process.execPath, [validator], {
    cwd: root,
    env: { ...process.env, GITHUB_WORKSPACE: root },
    encoding: 'utf8',
  })
  assert.match(output, /configuration is valid \(ios\)/)
  assert.doesNotMatch(output, /com\.example\.app/)
})

test('rejects secret-like fields', () => {
  const root = fixture({ ...valid, api_token: 'not-a-real-token' })
  const result = spawnSync(process.execPath, [validator], {
    cwd: root,
    env: { ...process.env, GITHUB_WORKSPACE: root },
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /credentials are not allowed/)
  assert.doesNotMatch(result.stderr, /not-a-real-token/)
})

test('rejects path traversal and ambiguous lockfiles', () => {
  const root = fixture(valid)
  fs.writeFileSync(path.join(root, 'yarn.lock'), '')
  const locks = spawnSync(process.execPath, [validator], {
    cwd: root,
    env: { ...process.env, GITHUB_WORKSPACE: root },
    encoding: 'utf8',
  })
  assert.notEqual(locks.status, 0)
  assert.match(locks.stderr, /exactly one/)

  const traversal = spawnSync(process.execPath, [validator, '--project-path=../'], {
    cwd: root,
    env: { ...process.env, GITHUB_WORKSPACE: root },
    encoding: 'utf8',
  })
  assert.notEqual(traversal.status, 0)
  assert.match(traversal.stderr, /must stay inside/)
})

test('does not echo malformed configuration and rejects output injection', () => {
  const malformedRoot = fixture(valid)
  const marker = 'private-value-must-not-appear'
  fs.writeFileSync(path.join(malformedRoot, '.xlate', 'preview.json'), `{ "name": "${marker}", broken }`)
  const malformed = spawnSync(process.execPath, [validator], {
    cwd: malformedRoot,
    env: { ...process.env, GITHUB_WORKSPACE: malformedRoot },
    encoding: 'utf8',
  })
  assert.notEqual(malformed.status, 0)
  assert.doesNotMatch(malformed.stderr, new RegExp(marker))

  const injectionRoot = fixture({ ...valid, name: 'Example\nplatforms=unexpected' })
  const injection = spawnSync(process.execPath, [validator], {
    cwd: injectionRoot,
    env: { ...process.env, GITHUB_WORKSPACE: injectionRoot },
    encoding: 'utf8',
  })
  assert.notEqual(injection.status, 0)
  assert.match(injection.stderr, /single line/)
})
