import { getRedisReaderWriter } from '@/shared/cache/redisClient';
import {
    buildEmailTokenKey,
    parseEmailTokenValue,
} from './lib/emailTokenRecord';
import type { EmailTokenStore } from './types';

/**
 * Upstash Redis 기반 EmailTokenStore 생성 — 환경변수 부재 시 null (caller가 graceful degrade 결정).
 * 읽기(get)는 reader, 쓰기·삭제·consume은 writer 클라이언트를 쓴다.
 */
export function createEmailTokenStore(): EmailTokenStore | null {
    const pair = getRedisReaderWriter();
    if (pair === null) return null;
    const { writer, reader } = pair;

    return {
        async set(purpose, email, value, ttlSeconds) {
            await writer.set(buildEmailTokenKey(purpose, email), value, {
                ex: ttlSeconds,
            });
        },
        async get(purpose, email) {
            const raw = await reader.get<unknown>(
                buildEmailTokenKey(purpose, email)
            );
            return parseEmailTokenValue(raw);
        },
        async delete(purpose, email) {
            await writer.del(buildEmailTokenKey(purpose, email));
        },
        async consume(purpose, email) {
            // GETDEL은 값 조회와 삭제를 한 왕복으로 처리한다. 동시에 들어온 비밀번호 재설정
            // 확인 중 하나만 pending 토큰을 받게 하는 단일 사용 보장의 근거다.
            const raw = await writer.getdel<unknown>(
                buildEmailTokenKey(purpose, email)
            );
            return parseEmailTokenValue(raw);
        },
    };
}
