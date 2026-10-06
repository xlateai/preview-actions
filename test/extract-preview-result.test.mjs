import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const script = 'scripts/extract-preview-result.py'

function extract(input) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'xlate-preview-result-'))
  const source = path.join(directory, 'input.ndjson')
  const result = path.join(directory, 'result.json')
  fs.writeFileSync(source, input)
  const run = spawnSync('python3', [script, source, result], { encoding: 'utf8' })
  return { run, result: run.status === 0 ? JSON.parse(fs.readFileSync(result, 'utf8')) : null }
}

test('extracts a preview result concatenated after a GitHub API response', () => {
  const { run, result } = extract(
    '{"html_url":"https://github.com/xlateai/lang/pull/130#comment"}' +
    '{"id":"preview_1","page_url":"https://builds.xlate.ai/previews/preview_1","builds":[]}',
  )
  assert.equal(run.status, 0, run.stderr)
  assert.equal(result.id, 'preview_1')
})

test('rejects lookalike and non-HTTPS build hosts', () => {
  for (const url of ['https://builds.xlate.ai.example.com/p/1', 'http://builds.xlate.ai/p/1']) {
    const { run } = extract(JSON.stringify({ page_url: url }))
    assert.notEqual(run.status, 0)
  }
})
