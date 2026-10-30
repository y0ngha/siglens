'use client';

/**
 * 분석 결과를 전문가 리포트 텍스트로 만들어 클립보드에 복사하는 훅.
 */
import { useTranslations } from 'next-intl';
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
    KrxTickTable,
} from '@y0ngha/siglens-core';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { buildExpertAnalysisReport } from '../utils/buildExpertAnalysisReport';
import type { CopyReportState } from '../model/types';

interface UseCopyAnalysisReportInput {
    symbol: string;
    krxTickTable: KrxTickTable;
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
    /** true면 복사하지 않는다 — 분석 진행 중이거나 상세가 잠긴 경우. */
    disabled: boolean;
}

interface UseCopyAnalysisReportReturn {
    copyState: CopyReportState;
    copyReport: () => void;
}

/**
 * 리포트 생성·복사와 버튼 상태(idle/copied/failed)를 소유한다.
 *
 * 리포트 생성은 SSE로 받은 분석 데이터를 읽는다 — 형태가 어긋나 던지면 패널이 깨지는
 * 대신 복사 실패로 보이게, 생성 자체를 함수로 `copy()`에 넘긴다.
 */
export function useCopyAnalysisReport({
    symbol,
    krxTickTable,
    analysis,
    keyLevels,
    disabled,
}: UseCopyAnalysisReportInput): UseCopyAnalysisReportReturn {
    const tLabel = useTranslations('shared.enumLabel');
    const tReport = useTranslations('widgets.analysis.expertReport');
    const skillLabel = useSkillLabel();
    const { copied, failed, copy } = useCopyToClipboard();
    const copyState: CopyReportState = copied
        ? 'copied'
        : failed
          ? 'failed'
          : 'idle';

    const copyReport = (): void => {
        if (disabled) return;
        void copy(() =>
            buildExpertAnalysisReport({
                tReport,
                symbol,
                krxTickTable,
                analysis,
                keyLevels,
                skillLabel,
                // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접
                // 호출하는 패턴"만 본다 — `tLabel`을 그대로 넘기면(참조 전달)
                // 호출부가 다른 파일(buildExpertAnalysisReport.ts)이라 감지되지
                // 않아 `shared.enumLabel`이 이 라우트의 클라이언트 번들에서
                // 빠진다. 얇은 위임 클로저로 `tLabel(...)` 호출을 이 파일
                // 안에 남긴다(sentimentDisplay.ts의 SENTIMENT_LABEL_KEY export
                // 주석 참고 — 동일한 문제·동일한 해법).
                t: (key, values) => tLabel(key, values),
            })
        );
    };

    return { copyState, copyReport };
}
