declare module 'lumen:test-config' {const config:{apiKey:string;projectId:string;appId:string;authDomain:string};export default config;}
declare module 'lumen:service-config' {const config:Readonly<{mode:string;projectId:string;projectNumber:string;apiKey:string;appId:string;iosClientId:string;webClientId:string;bundleId:string;signedBundleId:string;callbackScheme:string;authDomain:string;approvedTestEnvironment:boolean}>;export default config;}
declare module 'lumen:native-account' {export * from './account';}
declare module 'lumen:canonical-sync' {export {ChatSync,fetchOriginal} from '../../src/lib/sync';}

declare module 'lumen:native-ai-approval' {const approval:import('./free-provider').AiApproval|null;export default approval;}
