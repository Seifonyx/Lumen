// The inputs every quota view uses, built from the store's state in one place (alerts and the Activity page agree).
import type { Catalog } from '../../types';
import type { QuotaView } from '../quota';
import { nextReset, resetTimeZone, type Provider, type UsageView } from '../usage';
import { PROVIDER_NAMES, providerOfId } from '../util';
import { collectQuotas, type QuotaMetric } from './quotas';

export const providerName = (p: string) => p === 'gemini' ? 'Google AI Studio' : p === 'lumen' ? 'Lumen cloud sync' : p === 'device' ? 'This device' : PROVIDER_NAMES[providerOfId(`${p}:x`)] || p;
const labelFrom = (catalog: Catalog | null) => (id: string) => catalog?.models.find((m) => m.id === id)?.label || id.split(':').slice(1).join(':') || id;

export function metricsFrom(s: { usage: UsageView | null; firebaseUsage: QuotaView; catalog: Catalog | null }, storage?: { usage: number; quota: number } | null): QuotaMetric[] {
  return collectQuotas({ usage: s.usage, cloud: s.firebaseUsage, storage, label: labelFrom(s.catalog), providerName, resetFor: (p) => nextReset(p as Provider), timeZoneFor: resetTimeZone });
}
