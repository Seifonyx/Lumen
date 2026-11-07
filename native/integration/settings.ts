import type {Lease} from './scope.ts';
export interface AccountSettingsPort {read(owner:string,lease:Lease):Promise<Record<string,unknown>|null>;write(owner:string,settings:Record<string,unknown>,lease:Lease):Promise<void>}
/** Explicitly simulated, memory-only account document. No provider keys or cloud SDK belong in this port. */
export class MemoryAccountSettings implements AccountSettingsPort {
 private records=new Map<string,Record<string,unknown>>();
 private check(owner:string,lease:Lease){if(owner!==lease.uid||!lease.valid())throw new DOMException('Account changed','AbortError');}
 async read(owner:string,lease:Lease){this.check(owner,lease);return structuredClone(this.records.get(owner)||null);}
 async write(owner:string,settings:Record<string,unknown>,lease:Lease){this.check(owner,lease);this.records.set(owner,structuredClone(settings));}
}
