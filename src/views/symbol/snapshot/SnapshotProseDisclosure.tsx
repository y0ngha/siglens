'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface SnapshotProseDisclosureProps {
    /** `<summary>`에 그릴 한 줄. 예: "지난 AI 분석 보기 · Apple Inc. · … 기준". */
    summaryLabel: string;
    children: ReactNode;
}

/**
 * SSR 스냅샷 산문을 **접기**로 감싸는 클라이언트 아일랜드.
 *
 * 예전에는 라이브 분석이 뜨면 이 섹션을 `display: none`으로 감췄다
 * (`[data-analysis-view='plain'] [data-snapshot-prose]`). 그 섹션은 2026-07 thin
 * 콘텐츠 절벽 대응으로 넣은 SEO 자산인데, 구글은 `display:none` 텍스트를
 * 감가하고 아코디언(접힌 `<details>`) 안의 텍스트는 명시적으로 동등하게 취급한다.
 * 그래서 숨김을 접기로 바꾼다 — 텍스트는 DOM에 그대로 남고, 사용자는 펼쳐서
 * 라이브 분석과 비교할 수 있다.
 *
 * 신호는 그대로 루트의 `data-analysis-view`다. 이 표식은 **라이브 위젯의**
 * `PlainAnalysisSwitch`만 세운다(스냅샷 안쪽 스위치는 `hideToggle`이라 세우지
 * 않는다 — 세우면 자기 자신을 접는다). 컴포넌트 트리가 갈라져 있어 공유 상태가
 * 없으므로 DOM 속성을 그대로 채널로 쓰고, `MutationObserver`로 관찰한다.
 *
 * SSR·JS 미실행·콜드 캐시에서는 표식이 없으므로 `open`으로 렌더된다 — 접기 이전과
 * 동일하게 펼쳐진 화면이고, 하이드레이션 불일치도 없다(초기 상태가 서버와 같다).
 *
 * `open`을 제어 상태로 붙들지 않는다. 사용자가 직접 펼치면 그건 DOM만의 변화이고,
 * 이 컴포넌트는 표식이 바뀔 때(= 사용자가 쉽게보기를 전환할 때)만 다시 렌더되므로
 * 그 손조작이 다음 전환까지 유지된다. 그 시점에 다시 맞춰지는 것이 옳다.
 */
export function SnapshotProseDisclosure({
    summaryLabel,
    children,
}: SnapshotProseDisclosureProps) {
    const [liveAnalysisShowing, setLiveAnalysisShowing] = useState(false);

    useEffect(() => {
        const root = document.documentElement;
        const read = () =>
            setLiveAnalysisShowing(root.dataset.analysisView === 'plain');
        // 관찰을 걸기 전에 한 번 읽는다 — 라이브 위젯의 효과가 먼저 돌았다면
        // 그 변경은 이미 지나갔고 옵저버는 잡지 못한다.
        read();
        const observer = new MutationObserver(read);
        observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-analysis-view'],
        });
        return () => observer.disconnect();
    }, []);

    return (
        <details className="group" open={!liveAnalysisShowing}>
            {/* 접기 어포던스는 제품에 이미 있는 것(ai.siglens.io/about FAQ)을 그대로 쓴다 —
                열리면 45° 도는 `+`. 새 아이콘을 들이지 않는다. */}
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-xs text-secondary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {summaryLabel}
                <span
                    aria-hidden="true"
                    className="text-secondary-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                >
                    +
                </span>
            </summary>
            <div className="mt-4 flex flex-col gap-4">{children}</div>
        </details>
    );
}
