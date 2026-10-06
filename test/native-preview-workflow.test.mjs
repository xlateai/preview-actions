import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const workflow = fs.readFileSync('.github/workflows/native-preview.yml', 'utf8')

test('android previews use an independent unsigned React Native build lane', () => {
  assert.match(workflow, /run-android: \$\{\{ steps\.validate\.outputs\.run-android \}\}/)
  assert.match(workflow, /react-native-android-build:/)
  assert.match(workflow, /xlate preview "\.xlate-project\/\$PROJECT_PATH" --android --local/)
  assert.match(workflow, /React Native Android preview for commit/)
  assert.match(workflow, /if: inputs\.signing-build-id == '' && needs\.request\.outputs\.run-android == 'true'/)
})

test('android-only requests do not require Apple signing inputs', () => {
  const appleValidation = workflow.indexOf(`if [[ "$COMMAND" == /preview || "$COMMAND" == '/preview(ios)' ]]`)
  const androidValidation = workflow.indexOf(`if [[ "$COMMAND" == /preview || "$COMMAND" == '/preview(android)' ]]`)
  assert.ok(appleValidation > 0)
  assert.ok(androidValidation > appleValidation)
  assert.match(workflow.slice(appleValidation, androidValidation), /APP_STORE_CONNECT_API_KEY_ID/)
  assert.doesNotMatch(workflow.slice(androidValidation, workflow.indexOf('react-native-build:', androidValidation)), /APP_STORE_CONNECT_API_KEY_ID/)
})

test('android previews use connected signing or a bounded ephemeral fallback', () => {
  assert.match(workflow, /ANDROID_KEYSTORE_BASE64/)
  assert.match(workflow, /Android signing secrets must be configured as a complete set/)
  assert.match(workflow, /XOS_ANDROID_KEYSTORE_PATH/)
  assert.match(workflow, /-validity 30/)
})
