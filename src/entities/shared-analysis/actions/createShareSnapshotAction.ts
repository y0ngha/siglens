'use server';

import { hashUsageIp } from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { getClientIp } from '@/entities/chat-message/api/getClientIp';
import { DrizzleSharedAnalysisRepository } from '../api';
import { isValidShareInput } from '../server/assertValidInput';
import { checkShareRateLimit } from '../server/rateLimit';
import { buildShareSnapshot } from '../lib/buildShareSnapshot';
import { contentHash } from '../lib/contentHash';
import { generateShareId } from '../lib/generateShareId';
import { MS_PER_DAY } from '@/shared/config/time';
import type { CreateShareResult } from '../types';

const SHARE_TTL_DAYS = 7;

/**
 * 현재 탭의 AI 분석 결과를 스냅샷으로 DB에 저장하고 공유 id를 반환한다.
 *
 * 흐름:
 *   1. 서버측 입력 형태 검증 (isValidShareInput) — 클라 신뢰 X
 *   2. IP 해시 기반 rate limit (30/hour)
 *   3. 직렬화 안전 스냅샷 빌드 + content-hash dedupe upsert
 *   4. 성공: { ok: true, id } — 신규 생성 또는 기존 id 재사용
 */
export async function createShareSnapshotAction(
    rawInput: unknown
): Promise<CreateShareResult> {
    try {
        if (!isValidShareInput(rawInput)) {
            return { ok: false, code: 'invalid_input' };
        }
        const input = rawInput;

        const now = new Date();
        const ip = await getClientIp();
        const ipHash = hashUsageIp(ip, now);
        // Rate-limit runs before content-hash dedupe intentionally: re-sharing identical
        // content is uncommon and the token cost is acceptable; moving the dedupe check
        // first would require a DB round-trip before every rate-limit decision.
        if (!(await checkShareRateLimit(ipHash))) {
            return { ok: false, code: 'rate_limited' };
        }

        const snapshot = buildShareSnapshot(input);
        const expiresAt = new Date(now.getTime() + SHARE_TTL_DAYS * MS_PER_DAY);
        const { db } = getDatabaseClient();
        const repo = new DrizzleSharedAnalysisRepository(db);
        const id = await repo.create({
            id: generateShareId(),
            kind: snapshot.kind,
            symbol: snapshot.symbol,
            contentHash: contentHash(
                snapshot.kind,
                snapshot.symbol,
                snapshot.result
            ),
            snapshot,
            sharerTier: input.sharerTier,
            userId: null,
            expiresAt,
        });
        return { ok: true, id };
    } catch (error) {
        console.error(
            '[createShareSnapshotAction] Failed to persist share snapshot',
            error
        );
        return { ok: false, code: 'persist_failed' };
    }
}
