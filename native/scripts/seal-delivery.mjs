// Private delivery over public artifact storage. The decryption key stays on the owner's PC.
import {randomBytes,createCipheriv,createDecipheriv,publicEncrypt,privateDecrypt,constants} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function seal(data,publicKey){
 const key=randomBytes(32),nonce=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key,nonce);
 const ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);
 const wrapped=publicEncrypt({key:publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key);
 key.fill(0);
 return JSON.stringify({version:1,algorithm:'RSA-OAEP-SHA256/AES-256-GCM',wrapped:wrapped.toString('base64'),nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')});
}
export function open(envelope,privateKey){
 const e=JSON.parse(envelope);
 if(e.version!==1||e.algorithm!=='RSA-OAEP-SHA256/AES-256-GCM')throw Error('Unsupported delivery envelope');
 const key=privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(e.wrapped,'base64'));
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(e.nonce,'base64'));
  decipher.setAuthTag(Buffer.from(e.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(e.ciphertext,'base64')),decipher.final()]);
 }finally{key.fill(0);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,input,key,output]=process.argv.slice(2);
 if(!['seal','open'].includes(mode)||!input||!key||!output)throw Error('Expected seal|open input key-file output');
 writeFileSync(output,mode==='seal'?seal(readFileSync(input),readFileSync(key)):open(readFileSync(input,'utf8'),readFileSync(key)),{mode:0o600});
 console.log('Private delivery '+(mode==='seal'?'encrypted':'decrypted')+'.');
}
