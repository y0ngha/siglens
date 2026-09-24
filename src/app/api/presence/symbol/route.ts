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
import { after } from 'next/server';
import { headers } from 'next/headers';
import {
    DrizzleSymbolViewRepository,
    type SymbolViewRepository,
} from '@/entities/symbol-view';
import { isBot } from '@/shared/api/isBot';
import { isAdmissibleSymbolShape } from '@/shared/config/market';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_BAD_REQUEST } = constants;

export const dynamic = 'force-dynamic';

/** 스크립트는 7일만 읽는다. 나머지는 사후 검수용 여유. */
const RETENTION_DAYS = 90;

/** `/api/presence`와 같은 패턴 — 별도 cron 없이 인스턴스당 KST 하루 1회 정리. */
let lastPrunedDate: string | null = null;

function noContent(): Response {
    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}

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

    // DB 클라이언트 생성까지 try 안에 둔다 — DATABASE_URL 부재로 던지면 프레임워크
    // 기본 500이 나가 "집계 실패는 화면을 깨뜨리지 않는다"가 뚫린다.
    let repo: SymbolViewRepository;
    try {
        const { db } = getDatabaseClient();
        repo = new DrizzleSymbolViewRepository(db);
        await repo.recordView(today, symbol);
    } catch (error) {
        console.error('[symbol-views] recordView failed:', error);
        // 정리도 건너뛴다 — lastPrunedDate를 소진하면 그날 남은 요청이 기회를 잃는다.
        return noContent();
    }

    if (lastPrunedDate !== today) {
        lastPrunedDate = today;
        after(async () => {
            try {
                await repo.pruneOlderThan(
                    kstDateKeyDaysBefore(today, RETENTION_DAYS)
                );
            } catch (error) {
                console.error('[symbol-views] prune failed:', error);
            }
        });
    }

    return noContent();
}
