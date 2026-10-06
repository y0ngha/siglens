/**
 * 종목 조회수 수집점. `SymbolViewPing`이 종목당 하루 한 번, 첫 신뢰 입력 뒤에 부른다.
 *
 * 경로가 `presence` 하위인 이유: `analytics`·`track`·`collect`·`view` 계열 단어가 든
 * 경로는 EasyList 계열 차단 목록이 막는다.
 *
 * 형상만 맞는 존재하지 않는 심볼도 저장된다. 스크립트 임계값 아래에 머물고 스크립트가
 * FMP·DB로 다시 검증하므로 무해하다. 행 수 상한은 보존 기간이 정한다.
 */
import { constants } from 'node:http2';
import { headers } from 'next/headers';
import {
    DrizzleSymbolViewRepository,
    type SymbolViewRepository,
} from '@/entities/symbol-view/api';
import { isBot } from '@/shared/api/isBot';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { createDailyPruner, noContent } from '../_shared/dailyPruner';

const { HTTP_STATUS_BAD_REQUEST } = constants;

export const dynamic = 'force-dynamic';

/** 스크립트는 7일만 읽는다. 나머지는 사후 검수용 여유. */
const RETENTION_DAYS = 90;

/** `/api/presence`와 같은 패턴 — 별도 cron 없이 인스턴스당 KST 하루 1회 정리. */
const pruneOncePerDay = createDailyPruner(RETENTION_DAYS, '[symbol-views]');

async function readSymbol(request: Request): Promise<string | null> {
    try {
        const body: unknown = await request.json();
        if (typeof body !== 'object' || body === null) return null;
        const { symbol } = body as { symbol?: unknown };
        if (typeof symbol !== 'string') return null;
        const upper = symbol.toUpperCase();
        return isAdmissibleSymbolShape(upper) ? upper : null;
    } catch {
        return null;
    }
}

export async function POST(request: Request): Promise<Response> {
    if (isBot(await headers())) return noContent();
    if (process.env.NODE_ENV !== 'production') return noContent();

    const symbol = await readSymbol(request);
    if (symbol === null) {
        return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
    }

    const today = kstDateKey(new Date());
    afterWithDrain(() => recordSymbolView(today, symbol));
    return noContent();
}

/**
 * 조회 기록 + 하루 1회 정리. **응답을 보낸 뒤**(`afterWithDrain`) 돈다 — 비콘은 결과를 읽지
 * 않으므로(늘 204) DB upsert 왕복을 응답 경로에 둘 이유가 없다(2026-10 서버 성능 감사 L8).
 * 배포 중 SIGTERM drain은 이 작업을 기다린다.
 *
 * DB 클라이언트 생성까지 try 안에 둔다 — DATABASE_URL 부재로 던지면 이 작업이 통째로
 * reject한다. 응답은 이미 나갔지만 로그 없이 사라지면 집계 누락을 알아챌 수 없다.
 */
async function recordSymbolView(today: string, symbol: string): Promise<void> {
    let repo: SymbolViewRepository;
    try {
        const { db } = getDatabaseClient();
        repo = new DrizzleSymbolViewRepository(db);
        await repo.recordView(today, symbol);
    } catch (error) {
        console.error('[symbol-views] recordView failed:', error);
        // 정리도 건너뛴다 — 이유는 `createDailyPruner` 참조.
        return;
    }
    await pruneOncePerDay(today, repo);
}
