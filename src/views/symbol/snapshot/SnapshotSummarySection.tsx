import { useId, type ReactNode } from 'react';

interface SnapshotSummarySectionProps {
    /** 섹션 헤딩 텍스트. 생략 시 "최근 분석 요약". */
    title?: string;
    /** 캡션에 노출되는 심볼 표시명(예: "Apple Inc."). */
    displayName: string;
    children: ReactNode;
}

const DEFAULT_TITLE = '최근 분석 요약';

/**
 * pre-warm된 SEO 분석 스냅샷의 프로즈 콘텐츠를 감싸는 재사용 셸.
 * `TechnicalFactsSummary`와 동일한 컨테이너/헤딩 컨벤션(bg-secondary-800
 * 카드, text-secondary-200 헤딩)을 따르는 순수 프레젠테이션 서버 컴포넌트다
 * — 'use client' 없음, 데이터 페칭 없음, request context 접근 없음.
 *
 * 프레임은 항상 그린다: 스냅샷·프로즈 존재 여부 판단은 호출부 책임이다.
 * 프로즈가 없을 때 빈 셸을 렌더하지 않으려면 호출부가 이 컴포넌트를 아예
 * 마운트하지 않아야 한다(예: `TechnicalSnapshotProse`가 summary 부재 시
 * `null`을 반환해 이 셸을 감싸지 않는 것과 동일한 계약).
 *
 * "전일 장마감 기준" 캡션은 고정 라벨이다 — ISR 재검증 시점마다 값이
 * 달라지는 `new Date()` 기반 타임스탬프를 렌더에서 사용하지 않는다
 * (결정적 출력 유지, cold-gen dynamic API 회피).
 */
export function SnapshotSummarySection({
    title = DEFAULT_TITLE,
    displayName,
    children,
}: SnapshotSummarySectionProps) {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            className="bg-secondary-800 flex flex-col gap-3 rounded-lg p-4"
        >
            <div className="flex flex-col gap-1">
                <h2
                    id={headingId}
                    className="text-secondary-200 text-sm font-semibold"
                >
                    {title}
                </h2>
                <p className="text-secondary-400 text-xs">
                    {displayName} · 전일 장마감 기준
                </p>
            </div>
            {children}
        </section>
    );
}
