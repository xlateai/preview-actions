import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolveRequest } from '../scripts/distribution-request.mjs'
const sha='a'.repeat(40)
function fixture(t, config={name:'Xlate',android:{identifier:'ai.xlate.devlate'}}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'devlate-request-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 fs.mkdirSync(path.join(root,'.xlate'));fs.writeFileSync(path.join(root,'.xlate/preview.json'),JSON.stringify(config))
 return {root,sha,repository:'xlateai/website',event:{inputs:{}}}
}
test('one import derives app identity and platform from the project',t=>{
 const result=resolveRequest(fixture(t));assert.equal(result.identifier,'ai.xlate.devlate');assert.equal(result.command,'/preview(android)');assert.equal(result.title,'Xlate preview')
})
test('rejects stale source, arbitrary fields, and traversal',t=>{
 const input=fixture(t)
 for(const request of [{expected_sha:'b'.repeat(40)},{token:'secret'},{platforms:'shell'}])assert.throws(()=>resolveRequest({...input,event:{inputs:{request:JSON.stringify(request)}}}))
 assert.throws(()=>resolveRequest({...input,projectPath:'../outside'}),/inside/)
})
test('iOS selects its connected protected environment without needing credentials in preflight',t=>{
 const input=fixture(t,{name:'Xlate',ios:{identifier:'ai.xlate.devlate'}})
 assert.throws(()=>resolveRequest(input),/protected iOS/)
 const result=resolveRequest({...input,signingEnvironment:'xos-preview-ios-ai-xlate-devlate-12345678'})
 assert.equal(result.command,'/preview(ios)');assert.equal(result.appleTeam,'')
})
test('device reissue retains exact build/application/source binding',t=>{
 const input=fixture(t,{ios:{identifier:'ai.xlate.devlate'}})
 const request={signing_build_id:'build_'+'a'.repeat(24),preparation_id:'prepare_'+'b'.repeat(24),source_sha:sha,application_identifier:'ai.xlate.devlate'}
 const result=resolveRequest({...input,signingEnvironment:'xos-preview-ios-ai-xlate-devlate-12345678',event:{inputs:{request:JSON.stringify(request)}}})
 assert.equal(result.signingBuild,request.signing_build_id);assert.equal(result.preparation,request.preparation_id)
 assert.throws(()=>resolveRequest({...input,event:{inputs:{request:JSON.stringify({...request,application_identifier:'ai.other.app'})}}}),/does not match/)
})
test('rejects application and configuration symlinks outside the checkout',t=>{
 const input=fixture(t),outside=fs.mkdtempSync(path.join(os.tmpdir(),'devlate-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}))
 fs.symlinkSync(outside,path.join(input.root,'outside'));assert.throws(()=>resolveRequest({...input,projectPath:'outside'}),/escapes/)
 fs.writeFileSync(path.join(outside,'config.json'),'{}');fs.unlinkSync(path.join(input.root,'.xlate/preview.json'));fs.symlinkSync(path.join(outside,'config.json'),path.join(input.root,'.xlate/preview.json'))
 assert.throws(()=>resolveRequest(input),/escapes/)
})
