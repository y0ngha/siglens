'use client';

import { useAnalysisView } from '@/shared/model/analysisView';
import { cn } from '@/shared/lib/cn';
import type { AnalysisFeedbackContext } from '@/entities/feedback/types';
import { AiFeedbackButtons } from './AiFeedbackButtons';

interface AnalysisFeedbackProps {
    /** 위젯이 아는 식별 맥락. `viewMode`는 여기서 채운다. */
    readonly context: Omit<AnalysisFeedbackContext, 'viewMode'>;
    /** 화면에 보이는 결과 객체. 서버가 크기를 자른다. */
    readonly snapshot: unknown;
    /**
     * 쉽게보기 산문. 있고 쉽게보기 모드면 사용자가 본 것은 산문이므로 `viewMode`를 `plain`으로 기록한다.
     * 산문이 없는 위젯은 생략한다(항상 `full`).
     */
    readonly plain?: string | null;
    readonly className?: string;
}

/**
 * siglens 분석 결과 아래에 붙는 👍/👎 - 위젯 11곳이 같은 모양으로 쓴다. 쉽게보기/원본 전환은
 * 여기서 읽는다: 같은 결과를 어느 표현으로 보고 평가했는지가 품질 판단에 필요해서다.
 * 끝난 결과에서만 렌더하는 것은 호출부 책임이다(스트리밍·대기·오류 상태엔 두지 않는다).
 */
export function AnalysisFeedback({
    context,
    snapshot,
    plain,
    className,
}: AnalysisFeedbackProps) {
    const [mode] = useAnalysisView();
    const hasPlain = typeof plain === 'string' && plain.trim().length > 0;
    const viewMode = hasPlain && mode === 'plain' ? 'plain' : 'full';
    return (
        <AiFeedbackButtons
            className={cn('self-start', className)}
            target={{
                surface: 'siglens',
                context: { ...context, viewMode },
                snapshot,
            }}
        />
    );
}
