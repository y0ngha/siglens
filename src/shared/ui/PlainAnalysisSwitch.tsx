'use client';

import { useEffect } from 'react';

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
    /**
     * 토글을 그리지 않는다. 같은 화면에 이미 다른 토글이 있을 때 쓴다.
     *
     * 차트 탭이 그렇다 — 라이브 `AnalysisPanel`이 토글을 소유하고, SSR 스냅샷은
     * 봇에게 평이화를 실어 보내는 역할만 맡는다. 둘 다 그리면 한 화면에 쉽게보기가
     * 두 개가 된다. 표시 모드는 전역 하나(`useAnalysisView`)라 토글 없이도 함께
     * 움직인다.
     */
    hideToggle?: boolean;
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
    hideToggle = false,
    hasLockedDetails = false,
    children,
    renderToggle,
    className,
}: PlainAnalysisSwitchProps) {
    const [mode, setMode] = useAnalysisView();
    const hasPlain = typeof plain === 'string' && plain.trim().length > 0;

    /**
     * **서버 렌더에서도 평이화를 낸다.**
     *
     * `usePersistentState`의 `getServerSnapshot`이 기본값(`'plain'`)을 돌려주므로
     * SSR에서 곧바로 평이화가 렌더된다. 한때 하이드레이션 게이트로 SSR을 원문에
     * 묶어 두었는데, 실익이 없어 걷어냈다 — 주력 크롤러(Googlebot)는 JS를 실행하고
     * localStorage가 비어 어차피 기본값을 타므로, 게이트는 비렌더 크롤러의 본문만
     * 바꾸면서 사용자에게 원문→평이화 깜빡임을 하나 더 만들었다.
     *
     * 색인되는 본문이 전문 산문에서 평이화로 바뀐다는 뜻이다. 의도된 선택이다:
     * 이 사이트의 실제 유입은 롱테일 `<티커> 주가` 질의이고, SERP 스니펫으로
     * 노출되는 문장은 평이화 쪽이 그 질의에 직접 답한다. 잃는 것은 지표·패턴
     * 고유명 토큰(실측: 원문 21회 → 평이화 0회)인데, 그 토큰들이 잡는 질의는
     * 이 사이트의 수요가 아니다. 분량은 오히려 늘어난다(실측 4,591 → 7,387자).
     *
     * 되돌리려면 `hasPlain && mode === 'plain'` 앞에 마운트 게이트를 다시 두면
     * 된다. 섹션 제목·종목명·날짜는 이 스위치 바깥이라 어느 쪽이든 유지된다.
     */
    const showPlain = hasPlain && mode === 'plain';

    /**
     * 쉽게보기일 때 페이지의 SSR 스냅샷 산문을 함께 감춘다.
     *
     * 이 스위치는 `AnalysisPanel` 안쪽만 감싼다. 같은 페이지에는 크롤러용 SSR
     * 형제 노드(`data-snapshot-prose`)가 따로 있고, 거기엔 전문 용어가 그대로
     * 들어 있다 — 실증: 토글을 쉽게로 둔 채 스크롤하면 `EMA9`·`VWAP`·`볼린저 %B`·
     * `돈치안 상단`이 그대로 나왔고, 쉽게/원본을 전환해도 그 구간 텍스트가
     * **완전히 동일**했다. 쉽게보기를 켠 사람에게 절반만 쉬운 화면이 된다.
     *
     * 조건부 렌더가 아니라 루트 속성 + CSS로 감추는 이유는 그 섹션이 SEO 자산이기
     * 때문이다(2026-07 thin 콘텐츠 절벽 대응으로 넣었고, Suspense fallback 안에
     * 두면 크롤러 렌더러에서 사라진다는 사실이 이미 한 번 관측됐다). 숨김은
     * `hasPlain`을 조건으로 하므로 봇에게는 발동하지 않는다 — 봇은
     * `withReaderViews`에서 평이화를 건너뛰어 `plain`이 항상 `null`이다.
     */
    useEffect(() => {
        if (!showPlain) return;
        const root = document.documentElement;
        root.dataset.analysisView = 'plain';
        return () => {
            delete root.dataset.analysisView;
        };
    }, [showPlain]);

    const toggle =
        hasPlain && !hideToggle ? (
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
