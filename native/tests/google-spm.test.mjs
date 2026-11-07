import test from 'node:test';
import assert from 'node:assert/strict';
import {linkGoogleSignIn} from '../scripts/google-spm.mjs';
const manifest='let package = Package(dependencies: [\n], targets: [.target(dependencies: [.product(name: "Capacitor", package: "capacitor-swift-pm")])])';
test('normal offline iOS build never links or fetches Google SDK',()=>{
 assert.equal(linkGoogleSignIn(manifest,false),manifest);
 assert.equal(linkGoogleSignIn(manifest),manifest);
});
test('isolated test build links exactly one reviewed Google SDK',()=>{
 const result=linkGoogleSignIn(manifest,true);
 assert.match(result,/GoogleSignIn-iOS\.git/);
 assert.match(result,/exact: "10\.1\.0"/);
 assert.match(result,/product\(name: "GoogleSignIn"/);
 assert.equal((result.match(/GoogleSignIn-iOS/g)||[]).length,2);
 assert.throws(()=>linkGoogleSignIn(result,true),/Unexpected preconfigured Google SDK/);
});
test('unknown Swift package template refuses isolated test SDK injection',()=>{
 assert.throws(()=>linkGoogleSignIn('Package()',true),/Unknown Capacitor Swift package template/);
});
