import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

test('isolated test rules require a flagged test Google identity and same owner',()=>{
 const rules=readFileSync(fileURLToPath(new URL('../firebase-test.rules',import.meta.url)),'utf8');
 assert.match(rules,/rules_version = '2'/);
 assert.match(rules,/request\.auth\.token\.firebase\.sign_in_provider == 'google.com'/);
 assert.match(rules,/request\.auth\.token\.lumenIosTest == true/);
 assert.match(rules,/request\.auth\.uid == uid/);
 assert.match(rules,/match \/modelRouter\/\{uid\}\/\{document=\*\*\}/);
 assert.doesNotMatch(rules,/allow\s+(read|write|create|get|list|update|delete)\s*:\s*if\s+true/);
 assert.doesNotMatch(rules,/match\s+\/(?:\{path|modelRouterShares|modelRouterShared)/);
});
