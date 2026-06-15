import 'server-only';
import { createHash } from 'node:crypto';

const CACHE_CONFIG_FINGERPRINT_LENGTH = 12;

export function createCacheConfigFingerprint(serializedConfig: string): string {
    return createHash('sha256')
        .update(serializedConfig)
        .digest('hex')
        .slice(0, CACHE_CONFIG_FINGERPRINT_LENGTH);
}
