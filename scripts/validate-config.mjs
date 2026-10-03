import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const MAX_CONFIG_BYTES = 128 * 1024
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$/
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/
const SECRET_KEY = /(^|_)(api_?key|credential|password|private_?key|secret|token)s?($|_)/i
const TOP_LEVEL_KEYS = new Set(['name', 'version', 'icon', 'native_generation', 'ios', 'android'])
const IOS_KEYS = new Set(['identifier', 'workspace', 'project', 'scheme', 'configuration', 'info_plist', 'portable_pod_checksums'])
const ANDROID_KEYS = new Set(['identifier', 'directory', 'module', 'task', 'apk'])

function fail(message) {
  throw new Error(message)
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`)
  return value
}

function string(value, label, pattern) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`)
  const normalized = value.trim()
  if (/[\0\r\n]/.test(normalized)) fail(`${label} must be a single line`)
  if (normalized.length > 256) fail(`${label} is unexpectedly long`)
  if (pattern && !pattern.test(normalized)) fail(`${label} has an invalid format`)
  return normalized
}

function knownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${label} contains unsupported field ${JSON.stringify(key)}`)
  }
}

function rejectSecretFields(value, at = 'configuration') {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) fail(`${at} contains a secret-like field; credentials are not allowed in preview.json`)
    rejectSecretFields(child, `${at}.${key}`)
  }
}

function relativePath(value, label) {
  const candidate = string(value, label)
  if (path.isAbsolute(candidate)) fail(`${label} must be repository-relative`)
  const normalized = path.posix.normalize(candidate.replaceAll('\\', '/'))
  if (normalized === '..' || normalized.startsWith('../')) fail(`${label} must stay inside the project`)
  return normalized
}

function optionalRelative(value, label) {
  return value === undefined ? undefined : relativePath(value, label)
}

function writeOutputs(values) {
  const output = process.env.GITHUB_OUTPUT
  if (!output) return
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join('')
  fs.appendFileSync(output, lines, { encoding: 'utf8' })
}

function inputProjectPath() {
  const argument = process.argv.find((value) => value.startsWith('--project-path='))
  if (argument) return argument.slice('--project-path='.length)
  return process.env['INPUT_PROJECT-PATH'] || '.'
}

function validatePlatform(value, platform) {
  const config = object(value, platform)
  knownKeys(config, platform === 'ios' ? IOS_KEYS : ANDROID_KEYS, platform)
  string(config.identifier, `${platform}.identifier`, IDENTIFIER)

  if (platform === 'ios') {
    const hasWorkspace = config.workspace !== undefined
    const hasProject = config.project !== undefined
    if (hasWorkspace === hasProject) fail('ios must define exactly one of workspace or project')
    optionalRelative(config.workspace, 'ios.workspace')
    optionalRelative(config.project, 'ios.project')
    optionalRelative(config.info_plist, 'ios.info_plist')
    string(config.scheme, 'ios.scheme')
    string(config.configuration, 'ios.configuration')
    if (config.portable_pod_checksums !== undefined && typeof config.portable_pod_checksums !== 'boolean') {
      fail('ios.portable_pod_checksums must be a boolean')
    }
  } else {
    relativePath(config.directory, 'android.directory')
    relativePath(config.apk, 'android.apk')
    string(config.module, 'android.module')
    string(config.task, 'android.task')
  }
}

function main() {
  const workspace = fs.realpathSync(process.env.GITHUB_WORKSPACE || process.cwd())
  const requested = relativePath(inputProjectPath(), 'project-path')
  const project = fs.realpathSync(path.resolve(workspace, requested))
  const insideWorkspace = project === workspace || project.startsWith(`${workspace}${path.sep}`)
  if (!insideWorkspace) fail('project-path resolves outside the repository workspace')

  const configPath = path.join(project, '.xlate', 'preview.json')
  const stat = fs.statSync(configPath)
  if (!stat.isFile()) fail('.xlate/preview.json must be a regular file')
  if (stat.size > MAX_CONFIG_BYTES) fail('.xlate/preview.json is unexpectedly large')

  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    fail('.xlate/preview.json must contain valid JSON')
  }
  const config = object(parsed, 'configuration')
  rejectSecretFields(config)
  knownKeys(config, TOP_LEVEL_KEYS, 'configuration')

  const name = string(config.name, 'name')
  const version = string(config.version, 'version', VERSION)
  if (config.icon !== undefined) relativePath(config.icon, 'icon')
  if (!['expo', 'existing'].includes(config.native_generation)) {
    fail('native_generation must be either expo or existing')
  }

  const platforms = []
  if (config.ios !== undefined) {
    validatePlatform(config.ios, 'ios')
    platforms.push('ios')
  }
  if (config.android !== undefined) {
    validatePlatform(config.android, 'android')
    platforms.push('android')
  }
  if (!platforms.length) fail('at least one of ios or android must be configured')

  const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].filter((file) => fs.existsSync(path.join(project, file)))
  if (lockfiles.length !== 1) fail('the project must contain exactly one npm, pnpm, or Yarn lockfile')

  writeOutputs({
    'application-name': name,
    'application-version': version,
    platforms: platforms.join(','),
  })
  console.log(`Xlate Preview configuration is valid (${platforms.join(', ')})`)
}

try {
  main()
} catch (error) {
  console.error(`::error::${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
