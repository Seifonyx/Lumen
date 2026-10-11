import assert from 'node:assert/strict';
import { editParts, makeEditReview, reviewText } from '../../src/lib/edit-review';
const base = 'first\nkeep\nlast\n';
const review = makeEditReview(base, {kind:'write',path:'a',content:'FIRST\nkeep\nLAST\n'}, 'demo/app@main', base);
assert.equal(review.parts.length,2);
assert.equal(reviewText({...review,decisions:['accepted','rejected']}),'FIRST\nkeep\nlast\n');
assert.equal(reviewText({...review,decisions:['rejected','accepted']}),'first\nkeep\nLAST\n');
assert.equal(reviewText({...review,decisions:['accepted','accepted']}),'FIRST\nkeep\nLAST\n');
assert.equal(reviewText(review),base);
for (const [before,after] of [['a\r\nb\r\n','A\r\nb\r\n'],['a','a\n'],['a\nb\n','b\n'],['','x'],['x','']]) {
 const r=makeEditReview(before,{kind:'write',path:'a',content:after},'r',before);
 assert.equal(reviewText({...r,decisions:r.parts.map(()=> 'accepted')}),after);
 assert.equal(reviewText(r),before);
}
const created=makeEditReview(null,{kind:'write',path:'a',content:''},'r',null);
assert.equal(created.parts.length,1);assert.equal(reviewText(created),null);assert.equal(reviewText({...created,decisions:['accepted']}),'');
const deleted=makeEditReview('',{kind:'delete',path:'a'},'r','');
assert.equal(reviewText({...deleted,decisions:['accepted']}),null);
assert.throws(()=>makeEditReview('a',{kind:'patch',path:'a',hunks:[{search:'absent',replace:'x'}]},'r','a'));
assert.equal(editParts('same','same').length,0);
console.log('PASS individual edits: selective composition, exact bytes, empty files, creation/deletion and invalid proposals');
