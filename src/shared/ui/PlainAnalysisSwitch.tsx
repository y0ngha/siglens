'use client';

import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { useAnalysisView } from '@/shared/model/analysisView';
import { AnalysisViewToggle } from './AnalysisViewToggle';
import { PlainAnalysisView } from './PlainAnalysisView';

interface PlainAnalysisSwitchProps {
    /**
     * 평이화 산문. SSE 라우트가 분석 결과와 함께 내려준다.
     *
     * `null`/`undefined`면 재작성이 실패했거나(가드 거부·마감 초과·설정 없음) 아직
     * 도착하지 않은 것이다. 그때는 토글을 렌더하지 않고 원본만 보여준다 — 아무 일도
     * 하지 않는 토글은 사용자가 고장으로 읽는다.
     */
    plain?: string | null;
    /** 티어 게이트로 가려진 정보가 있는지. 쉽게보기 하단 잠금 안내를 켠다. */
    hasLockedDetails?: boolean;
    /** 원본 뷰. 쉽게보기일 때는 **마운트하지 않는다**. */
    children: ReactNode;
    /**
     * 토글을 놓을 자리. 각 위젯의 헤더 모양이 달라 렌더 위치를 위임한다.
     * 넘기지 않으면 본문 위에 우측 정렬로 붙인다.
     */
    renderToggle?: (toggle: ReactNode) => ReactNode;
    className?: string;
}

/**
 * 분석 위젯 7종이 공유하는 쉽게보기/원본보기 스위치.
 *
 * 위젯마다 헤더 구조가 달라 토글 배치만 `renderToggle`로 위임하고, 상태·산문 렌더·
 * 원본 전환은 여기서 한 번만 구현한다. 상태는 `useAnalysisView`가 소유하는 전역
 * 하나라 어느 탭에서 바꾸든 모든 탭에 즉시 반영된다.
 *
 * 쉽게보기일 때 원본 트리를 **마운트하지 않는 것이 의도**다. 같은 내용을 DOM에 두 벌
 * 두면 스크린 리더가 중복해 읽고 페이로드도 두 배가 된다.
 */
export function PlainAnalysisSwitch({
    plain,
    hasLockedDetails = false,
    children,
    renderToggle,
    className,
}: PlainAnalysisSwitchProps) {
    const [mode, setMode] = useAnalysisView();
    const hasPlain = typeof plain === 'string' && plain.trim().length > 0;
    const showPlain = hasPlain && mode === 'plain';

    const toggle = hasPlain ? (
        <AnalysisViewToggle mode={mode} onChange={setMode} />
    ) : null;

    const body = showPlain ? (
        <PlainAnalysisView
            text={plain as string}
            hasLockedDetails={hasLockedDetails}
            onShowRaw={() => setMode('raw')}
        />
    ) : (
        children
    );

    if (renderToggle !== undefined) {
        return (
            <>
                {renderToggle(toggle)}
                {body}
            </>
        );
    }

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {toggle !== null && (
                <div className="flex justify-end">{toggle}</div>
            )}
            {body}
        </div>
    );
}
