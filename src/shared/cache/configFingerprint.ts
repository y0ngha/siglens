import 'server-only';
import { createHash } from 'node:crypto';

const CACHE_CONFIG_FINGERPRINT_LENGTH = 12;

/**
 * 직렬화된 캐시 설정의 sha256 앞 12자(hex). 설정이 바뀌면 값이 달라지므로 캐시 키에
 * 붙여 옛 설정으로 쓴 엔트리와 갈라 놓는 데 쓴다.
 */
export function createCacheConfigFingerprint(serializedConfig: string): string {
    return createHash('sha256')
        .update(serializedConfig)
        .digest('hex')
        .slice(0, CACHE_CONFIG_FINGERPRINT_LENGTH);
}
