import test from 'node:test';import assert from 'node:assert/strict';
import {validateServiceConfig,requestAllowed} from '../services/config.mjs';
const sample=()=>({mode:'isolated-test',projectId:'lumen-private-test',projectNumber:'123456789',apiKey:'test-public-sdk-config',appId:'1:123456789:web:abc123',iosClientId:'123456789-ios.apps.googleusercontent.com',webClientId:'123456789-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedTestEnvironment:true});
test('real native mode fails closed without isolated matching configuration',()=>{
 assert.throws(()=>validateServiceConfig({}));assert.throws(()=>validateServiceConfig({...sample(),projectId:'the-model-router'}));
 assert.throws(()=>validateServiceConfig({...sample(),bundleId:'other.app'}));assert.throws(()=>validateServiceConfig({...sample(),approvedTestEnvironment:false}));
 assert.throws(()=>validateServiceConfig({...sample(),iosClientId:'999-ios.apps.googleusercontent.com'}));
 assert.throws(()=>validateServiceConfig({...sample(),mode:'production-connected'}));assert.throws(()=>validateServiceConfig({...sample(),refreshToken:'never embed'}));
 assert.equal(validateServiceConfig(sample()).callbackScheme,'com.googleusercontent.apps.123456789-ios');
});
test('only exact configured auth/cloud requests; no provider inference or alternate project',()=>{
 const c=validateServiceConfig(sample());
 assert(requestAllowed(c,'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=test-public-sdk-config'));
 assert(!requestAllowed(c,'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=wrong'));
 assert(requestAllowed(c,'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Flumen-private-test%2Fdatabases%2F(default)'));
 for(const url of ['https://generativelanguage.googleapis.com/v1beta/models/x:generateContent','https://firestore.googleapis.com/v1/projects/the-model-router/databases/(default)/documents/x','https://firestore.googleapis.com.evil.test/','http://firestore.googleapis.com/','https://accounts.google.com/o/oauth2/auth'])assert(!requestAllowed(c,url));
});

test('existing-account release requires explicit production mode and preserves exact identity',()=>{
 const production={...sample(),mode:'account-connected',projectId:'the-model-router',approvedTestEnvironment:undefined,approvedExistingAccounts:true};delete production.approvedTestEnvironment;
 assert.equal(validateServiceConfig(production).mode,'account-connected');
 assert.throws(()=>validateServiceConfig({...production,approvedExistingAccounts:false}));
 assert.throws(()=>validateServiceConfig({...production,projectId:'arbitrary-prod'}));
 assert.throws(()=>validateServiceConfig({...production,mode:'isolated-test',approvedTestEnvironment:true}));
 assert.throws(()=>validateServiceConfig({...production,bundleId:'new.install.identity'}));
});
