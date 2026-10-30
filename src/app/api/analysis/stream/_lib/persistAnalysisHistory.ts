import type { AssembledPromptRecord } from '@y0ngha/siglens-core';
import { after } from 'next/server';
import {
    DrizzleAnalysisHistoryRepository,
    resolveGeneratedAt,
    type AnalysisHistoryTab,
} from '@/entities/analysis/analysisHistoryRepository';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';

/**
 * 모델 미지정 technical 요청이 `analysis_history.model_id`(감사용 컬럼)에 남기는 값.
 * `runAnalysis`가 `modelId` 생략 시 내부적으로 폴백하는 값과 같다(`entities/analysis/api.ts`).
 * 캐시 키와는 무관해 core 상수와 어긋나도 캐시 동작에는 영향이 없다.
 */
export const DEFAULT_TECHNICAL_MODEL_ID = 'analysis-worker';

/** `analysis_history` 한 행을 만드는 데 필요한 값. */
export interface PersistAnalysisHistoryInput {
    symbol: string;
    timeframe: string;
    tab: AnalysisHistoryTab;
    modelId: string;
    locale: Locale;
    result: unknown;
    /**
     * 캐시 미스 승자만 이 값을 받는다 — 동시 요청의 패자는 `undefined`다. 정상 경로이지
     * 실패가 아니며(core 계약, `AssembledPromptRecord` JSDoc), 그대로 repository에 넘겨
     * 프롬프트 컬럼이 null인 행을 남긴다.
     */
    prompt: AssembledPromptRecord | undefined;
}

/**
 * 새로 생성된 technical 분석 1건을 `analysis_history`에 최선노력으로 기록한다.
 *
 * `after()`로 스케줄한다 — 응답은 이미 SSE로 나간 뒤라 대기해도 체감 지연이 없다(`onPromptAssembled`는
 * 프로바이더 호출 직전에 동기 캡처만 하고 절대 await하지 않는다. 그건 응답 전 경로다).
 * `saveAnalysisHistory`는 throw하지 않고, 이 함수도 실패를 삼킨다.
 */
export function schedulePersistAnalysisHistory(
    input: PersistAnalysisHistoryInput
): void {
    // 스케줄한 순간이 아니라 분석 *자신의* 생성 시각을 우선한다. technical 축은 결과에 `analyzedAt`을
    // 찍고 overall 축은 안 찍어 지금으로 폴백한다. 이후 이력 창이 과거 판단을 소속 봉에 앵커링하므로,
    // 봉 경계를 넘길 만큼 늦게 찍힌 행은 엉뚱한 봉에 귀속된다.
    const generatedAt = resolveGeneratedAt(input.result);
    try {
        // `after()` 자체(콜백이 아니라)가 요청 스코프 밖에서 동기적으로 throw할 수 있다. 호출부는 이
        // 함수를 인라인으로 부르므로, 여기서 새면 이미 성공한 분석이 클라이언트에 보이는 에러가 된다.
        // 기록 실패가 그렇게 번지면 안 되므로 삼키고 로그만 남긴다.
        after(async () => {
            const { db } = getDatabaseClient();
            await new DrizzleAnalysisHistoryRepository(db).saveAnalysisHistory({
                symbol: input.symbol,
                timeframe: input.timeframe,
                tab: input.tab,
                modelId: input.modelId,
                locale: input.locale,
                result: input.result,
                generatedAt,
                prompt: input.prompt,
            });
        });
    } catch (err) {
        console.error(
            '[streamAnalysisRoute] schedulePersistAnalysisHistory failed:',
            err
        );
    }
}
