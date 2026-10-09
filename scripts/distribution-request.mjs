import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function resolveRequest({ event, projectPath = '.', platforms = 'auto', root, sha, repository, signingEnvironment = '', appleTeam = '' }) {
  const request = typeof event.inputs?.request === 'string' && event.inputs.request ? JSON.parse(event.inputs.request) : {}
  const keys = new Set(['platforms','expected_sha','pull_request','request_id','title','changed','test','signing_build_id','preparation_id','source_sha','application_identifier','signing_environment'])
  if (!request || Array.isArray(request) || typeof request !== 'object' || Object.keys(request).some(key => !keys.has(key))) throw Error('Unknown distribution request field')
  if (!/^[a-f0-9]{40}$/.test(sha) || (request.expected_sha && request.expected_sha !== sha)) throw Error('The requested commit moved; request a new distribution')
  if (projectPath !== '.' && (!/^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(projectPath) || projectPath.split('/').some(part => !part || part === '..' || part === '.'))) throw Error('Project path must remain inside the repository')
  const realRoot = fs.realpathSync(root), directory = fs.realpathSync(path.join(realRoot, projectPath))
  if (directory !== realRoot && !directory.startsWith(realRoot + path.sep)) throw Error('Project path escapes the repository')
  const configPath = fs.realpathSync(path.join(directory, '.xlate/preview.json'))
  if (!configPath.startsWith(directory + path.sep)) throw Error('Preview configuration escapes the project')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const selection = request.platforms || platforms
  if (!['auto','ios','android','all'].includes(selection)) throw Error('Platforms must be auto, ios, android, or all')
  const selected = ['ios','android'].filter(platform => config[platform] && (['auto','all'].includes(selection) || platform === selection))
  if (!selected.length || (['ios','android'].includes(selection) && !config[selection])) throw Error('The requested platform has no preview configuration')
  const identifier = config[selected[0]].identifier
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(identifier) || selected.some(platform => config[platform].identifier !== identifier)) throw Error('Selected platforms must identify the same application')
  const text = (key, fallback = '') => {
    const value = request[key] ?? fallback
    if (typeof value !== 'string' || value.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw Error(`Invalid ${key}`)
    return value
  }
  const signingBuild = text('signing_build_id'), preparation = text('preparation_id'), source = text('source_sha')
  if (signingBuild && !/^build_[A-Za-z0-9_-]{16,193}$/.test(signingBuild)) throw Error('Invalid signing build')
  if (preparation && (!signingBuild || !/^(?:prepare|prep)_[A-Za-z0-9_-]{16,193}$/.test(preparation) || !/^[a-f0-9]{40}$/.test(source))) throw Error('Invalid device preparation')
  if (request.application_identifier && request.application_identifier !== identifier) throw Error('Signing application does not match project configuration')
  const environment = text('signing_environment', signingEnvironment)
  if (selected.includes('ios') && !/^xos-preview-[A-Za-z0-9_-]{8,120}$/.test(environment)) throw Error('Connect this app’s protected iOS signing environment in Xlate before requesting an iOS build')
  if (request.pull_request != null && !/^[1-9][0-9]*$/.test(String(request.pull_request))) throw Error('Invalid pull request')
  return { project: repository.split('/')[1], path: projectPath, identifier,
    command: selected.length === 2 ? '/preview' : `/preview(${selected[0]})`,
    pr: String(request.pull_request || ''), requestId: text('request_id'),
    title: text('title', `${config.name || identifier} preview`), changed: text('changed'), test: text('test'),
    signingBuild, preparation, source, environment, appleTeam,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = resolveRequest({ event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), root: '.xlate-project',
      projectPath: process.env.PROJECT_PATH, platforms: process.env.PLATFORMS, sha: process.env.GITHUB_SHA,
      repository: process.env.GITHUB_REPOSITORY, signingEnvironment: process.env.SIGNING_ENVIRONMENT, appleTeam: process.env.APPLE_TEAM_ID })
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `config=${JSON.stringify(result)}\n`)
  } catch (error) { console.error(`::error::${error.message}`); process.exitCode = 1 }
}
