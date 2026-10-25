import assert from 'node:assert/strict';
import { requestProviderSettings, getProviderSettingsTarget } from '../../src/lib/provider-settings-target';
import { getRoutingScreen, restoreRoutingScreen, openRoutingCenter } from '../../src/lib/routing-center';
openRoutingCenter('providers');
const origin = getRoutingScreen();
assert.equal(requestProviderSettings('anthropic', 'owner-a'), true);
const settingsVisit = getRoutingScreen();
assert.equal(getProviderSettingsTarget('owner-a'), 'anthropic');
assert.equal(getProviderSettingsTarget('owner-b'), null);
restoreRoutingScreen(origin); // Cancel/Back, including before the lazy editor mounts.
assert.equal(getProviderSettingsTarget('owner-a'), null);
restoreRoutingScreen(settingsVisit); // Existing history restores the exact visit on Forward.
assert.equal(getProviderSettingsTarget('owner-a'), 'anthropic');
assert.equal(requestProviderSettings('not-a-provider', 'owner-a'), false);
assert.equal(getProviderSettingsTarget('owner-a'), null);
assert.equal(requestProviderSettings('gemini', undefined), false);
assert.equal(getProviderSettingsTarget('owner-a'), null);
requestProviderSettings('gemini','owner-a');
restoreRoutingScreen({open:false,section:'models'}); // Existing account-history reset.
assert.equal(getProviderSettingsTarget('owner-a'),null);
console.log('PASS canonical provider/account target, canceled visit, Back/Forward and account reset');
