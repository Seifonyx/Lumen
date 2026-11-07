// The offline build must not pull GoogleSignIn or alter the generated Swift package.
// Only a fully configured isolated-test build is permitted to link the reviewed SDK.
export function linkGoogleSignIn(manifest,enabled=false){
 if(!enabled)return manifest;
 const dependency='dependencies: [';
 const product='.product(name: "Capacitor",';
 if(!manifest.includes(dependency)||!manifest.includes(product))throw Error('Unknown Capacitor Swift package template');
 if(manifest.includes('GoogleSignIn-iOS')||manifest.includes('.product(name: "GoogleSignIn"'))throw Error('Unexpected preconfigured Google SDK');
 return manifest
  .replace(dependency,dependency+'\n        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", exact: "10.1.0"),')
  .replace(product,'.product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),\n                '+product);
}
