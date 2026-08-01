import { useId, type ReactNode } from 'react';
import { formatSnapshotAsOf } from '@/shared/lib/formatSnapshotAsOf';

interface SnapshotSummarySectionProps {
    /** 섹션 헤딩 텍스트. 생략 시 "최근 분석 요약". */
    title?: string;
    /** 캡션에 노출되는 심볼 표시명(예: "Apple Inc."). */
    displayName: string;
    /**
     * 스냅샷 행의 `generatedAt`. 있으면 h2 옆에 "지난 AI 분석" 배지를 렌더하고
     * 캡션에 실제 기준일을 노출한다. 없으면 기존 "전일 장마감 기준" 캡션으로
     * 폴백한다(배지 없음).
     */
    asOf?: Date;
    children: ReactNode;
}

const DEFAULT_TITLE = '최근 분석 요약';

/**
 * pre-warm된 SEO 분석 스냅샷의 프로즈 콘텐츠를 감싸는 재사용 셸.
 *
 * audit fix FIX 4: 카드 셸은 `TechnicalFactsSummary`(Suspense-fallback
 * 대역이라 `bg-secondary-800 rounded-lg p-4`가 정당화되는 예외 케이스)가
 * 아니라, 이 섹션들이 실제로 나란히 놓이는 제품 전역 우세 패턴(67곳)인
 * `border-secondary-700 bg-secondary-800 rounded-xl border p-6`을 따른다 —
 * 이전 셸은 소수 패턴(5곳)이라 이 섹션들이 주변 카드보다 부실해 보였다.
 * 순수 프레젠테이션 서버 컴포넌트다 — 'use client' 없음, 데이터 페칭 없음,
 * request context 접근 없음.
 *
 * 프레임은 항상 그린다: 스냅샷·프로즈 존재 여부 판단은 호출부 책임이다.
 * 프로즈가 없을 때 빈 셸을 렌더하지 않으려면 호출부가 이 컴포넌트를 아예
 * 마운트하지 않아야 한다(예: `TechnicalSnapshotProse`가 summary 부재 시
 * `null`을 반환해 이 셸을 감싸지 않는 것과 동일한 계약).
 *
 * 캡션은 `asOf`가 주어지면 스냅샷 행의 실제 기준일(`formatSnapshotAsOf`로
 * 포맷)을 노출하고, 없으면 고정 라벨 "전일 장마감 기준"으로 폴백한다. 두 경로
 * 모두 렌더 중 `new Date()`를 호출하지 않는다 — `asOf`는 항상 DB 행의
 * `generatedAt`에서 와야 하며, 그래야 같은 캐시 엔트리가 재검증 시점과 무관하게
 * 항상 같은 문자열을 렌더한다(결정적 출력 유지, cold-gen dynamic API 회피).
 *
 * A1(감사): `formatSnapshotAsOf`는 Invalid Date에 `null`을 반환한다(throw하지
 * 않음). 배지("지난 AI 분석")와 캡션 문구는 반드시 같은 조건에서 갈려야 한다 —
 * 그래서 포맷된 문자열을 먼저 계산해두고, `null`을 `asOf === undefined`와
 * 완전히 동일하게 취급한다. 조건이 갈라지면 배지는 뜨는데 캡션은 고정 문구인
 * (또는 그 반대인) 자기모순적 렌더가 생긴다.
 */
export function SnapshotSummarySection({
    title = DEFAULT_TITLE,
    displayName,
    asOf,
    children,
}: SnapshotSummarySectionProps) {
    const headingId = useId();
    const formattedAsOf = asOf === undefined ? null : formatSnapshotAsOf(asOf);
    const caption =
        formattedAsOf === null
            ? `${displayName} · 전일 장마감 기준`
            : `${displayName} · ${formattedAsOf} 미국 장마감 기준`;

    return (
        <section
            aria-labelledby={headingId}
            className="border-secondary-700 bg-secondary-800 flex flex-col gap-4 rounded-xl border p-6"
        >
            <div className="flex flex-col gap-1">
                {/*
                 * audit fix FIX 5: 헤딩 램프가 역전돼 있었다 — 이 h2가
                 * text-secondary-200/text-sm이고, 각 렌더러 내부 h3들이
                 * text-secondary-100/text-sm이라 h3가 자기 h2보다 더 밝고
                 * 같은 크기였다. 제품의 다른 카드 h2 컨벤션(text-lg
                 * font-semibold tracking-tight)으로 맞추고, h3는
                 * text-secondary-200(DESIGN.md:363 "subsection headers are
                 * neutral text-secondary-200")으로 낮춘다 — h3 쪽은 각
                 * *SnapshotProse.tsx 렌더러에서 처리.
                 */}
                <div className="flex flex-wrap items-center gap-2">
                    <h2
                        id={headingId}
                        className="text-secondary-100 text-lg font-semibold tracking-tight"
                    >
                        {title}
                    </h2>
                    {formattedAsOf !== null && (
                        <span className="border-secondary-600 text-secondary-300 bg-secondary-900/60 rounded-full border px-2 py-0.5 text-xs font-medium">
                            지난 AI 분석
                        </span>
                    )}
                </div>
                <p className="text-secondary-400 text-xs">{caption}</p>
            </div>
            {children}
        </section>
    );
}
