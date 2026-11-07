import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {seal,open} from '../scripts/seal-delivery.mjs';
test('private artifact roundtrip requires owner key and rejects tampering',()=>{
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const payload=randomBytes(4096),encrypted=seal(payload,publicKey);
 assert.deepEqual(open(encrypted,privateKey),payload);
 const other=generateKeyPairSync('rsa',{modulusLength:2048});
 assert.throws(()=>open(encrypted,other.privateKey));
 const e=JSON.parse(encrypted);e.ciphertext=(e.ciphertext[0]==='A'?'B':'A')+e.ciphertext.slice(1);
 assert.throws(()=>open(JSON.stringify(e),privateKey));
});
