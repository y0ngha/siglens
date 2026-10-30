import 'server-only';
import { createHash } from 'node:crypto';
import { isE2E } from '@/shared/api/e2eEnv';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import { tryGetDatabaseClient } from '@/shared/db/client';
import type { PlainTextRepository } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { PLAIN_PROMPT_VERSION } from '../lib/buildPlainPrompt';
import { DrizzlePlainTextRepository } from '../plainTextRepository';

/**
 * 저장소 조회 상한(ms). DB 클라이언트(postgres-js)는 연결 타임아웃(`connect_timeout`)만
 * 있고 쿼리 단위 타임아웃을 걸지 않아 DB가 매달리면 `find`가
 * 영영 끝나지 않고, 이 조회는 `withDeadline` **바깥**(생성 앞단)이라 그대로 사용자
 * 대기로 이어진다. 넘기면 미스로 취급하고 생성으로 넘어간다 — 정상 조회는 한 자릿수
 * ~수십 ms라 2.5초면 일시적 지연은 담으면서 매달림은 끊는다. 늦게 끝난 조회 결과는
 * 버려지고, 같은 키로의 중복 생성은 `ON CONFLICT DO NOTHING`이 흡수한다.
 */
export const PLAIN_STORE_READ_TIMEOUT_MS = 2_500;

let loggedDbUnavailable = false;

/**
 * 저장 키의 `input_digest`. **원문 산문 + 사실 블록의 해시**이고, 로케일과
 * 프롬프트 버전은 복합 PK의 다른 열이다(`analysis_plain_texts`). 사실 블록 중
 * 실시간 현재가(`facts.currentPrice`)만은 해시에서 뺀다 — 이유는 `rewriteToPlainLanguage`의 호출부 주석.
 *
 * 심볼·모델·타임프레임을 키에 넣지 않는다 — 같은 입력이면 결과가 같고, 입력이
 * 조금이라도 바뀌면 해시가 달라져 스스로 무효화된다.
 *
 * **티어도 넣지 않는다.** 입력이 core `filterAnalysisResult`를 통과한 payload이므로
 * free와 member는 산문 조각 수부터 달라 자동으로 다른 키를 얻는다(실측: free 5조각
 * vs member 21조각). 반대로 두 티어의 필터 결과가 실제로 같으면 같은 키를 공유하는데,
 * 그건 leak이 아니라 정확한 동작이다 — 티어 세그먼트를 넣으면 이 공유가 깨져
 * LLM 호출이 불필요하게 두 배가 된다.
 */
export function buildInputDigest(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
}

/**
 * DB가 없으면(`DATABASE_URL` 부재·오프라인 빌드) `null` — 호출자는 저장소 미스로
 * 취급하고 쓰기를 건너뛴다. 클라이언트 생성이 던져도 같다: 저장소 장애가
 * 평이화 생성 자체를 막아서는 안 된다.
 *
 * 다만 **조용히 넘어가지 않는다.** 저장소가 없으면 모든 요청이 LLM을 다시 부르는데
 * (비용), 예전 Redis 캐시도 미설정이면 똑같이 동작했기에 막지는 않는다. 대신 운영
 * 환경 오설정을 알아챌 수 있게 프로세스당 한 번 `console.error`를 남긴다 —
 * 요청마다 남기면 로그가 범람한다. 오프라인 빌드는 `tryGetDatabaseClient`가 따로
 * 경고하고, E2E는 이 함수에 도달하기 전에 끝나므로 둘 다 제외한다.
 */
export function tryCreateRepository(): PlainTextRepository | null {
    try {
        const client = tryGetDatabaseClient();
        if (client === null) {
            if (!loggedDbUnavailable && !isE2E() && !isOfflineBuild()) {
                loggedDbUnavailable = true;
                console.error(
                    '[analysis-plain] DB unavailable — plain texts will be regenerated on every request (LLM cost)'
                );
            }
            return null;
        }
        return new DrizzlePlainTextRepository(client.db);
    } catch (error) {
        console.error('[analysisPlain] repository unavailable', { error });
        return null;
    }
}

/**
 * 저장소 조회. 실패는 미스, `PLAIN_STORE_READ_TIMEOUT_MS`를 넘겨도 미스다.
 * 타이머는 조회가 끝나는 즉시 정리한다.
 */
export async function findStored(
    repository: PlainTextRepository | null,
    locale: Locale,
    inputDigest: string
): Promise<string | null> {
    if (repository === null) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>(resolve => {
        timer = setTimeout(() => {
            console.warn('[analysisPlain] store read timed out', {
                ms: PLAIN_STORE_READ_TIMEOUT_MS,
            });
            resolve(null);
        }, PLAIN_STORE_READ_TIMEOUT_MS);
    });
    try {
        return await Promise.race([
            repository
                .find(PLAIN_PROMPT_VERSION, locale, inputDigest)
                .catch(() => null),
            timeout,
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}
