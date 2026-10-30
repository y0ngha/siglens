'use server';

import { hashUsageIp } from '@y0ngha/siglens-core';
import { getClientIp } from '@/shared/api/getClientIp';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleSharedAnalysisRepository } from '../api';
import { buildShareSnapshot } from '../lib/buildShareSnapshot';
import { contentHash } from '../lib/contentHash';
import { generateShareId } from '../lib/generateShareId';
import { isValidShareInput } from '../server/assertValidInput';
import { checkShareRateLimit } from '../server/rateLimit';
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
        // rate limit을 content-hash dedupe보다 먼저 건다: 같은 내용을 다시 공유하는
        // 일은 드물어 그 비용은 감수할 만하고, dedupe를 앞세우면 매 rate limit 판단
        // 전에 DB 왕복이 필요해진다.
        if (!(await checkShareRateLimit(ipHash))) {
            return { ok: false, code: 'rate_limited' };
        }

        const snapshot = buildShareSnapshot(input);
        // 공유 스냅샷은 **생성 시점의 로케일로 고정**된다 — 저장된 본문이 그
        // 언어의 AI 산출물이라 나중에 다른 로케일로 다시 해석할 수 없다.
        const locale = await resolveRequestLocale();
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
                locale,
                snapshot.result,
                snapshot.chartBars,
                snapshot.plain
            ),
            locale,
            snapshot,
            sharerTier: input.sharerTier,
            userId: null,
            expiresAt,
        });
        return { ok: true, id };
    } catch (error) {
        // INSERT 실패 에러의 message에는 바인딩된 스냅샷 본문이 실리므로 원문을 로그에 남기지 않는다.
        logActionError(
            '[createShareSnapshotAction] Failed to persist share snapshot',
            error
        );
        return { ok: false, code: 'persist_failed' };
    }
}
