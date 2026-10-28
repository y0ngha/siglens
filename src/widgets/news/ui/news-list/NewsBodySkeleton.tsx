/**
 * 본문 자리 표시 — 본문 섹션과 같은 골격이라 본문이 도착해도 카드가 자라지 않는다.
 */
import { cn } from '@/shared/lib/cn';

/** 본문 자리 줄 폭 — 마지막 줄이 짧아 실제 문단처럼 보인다. */
const NEWS_BODY_SKELETON_LINE_WIDTHS = ['w-full', 'w-full', 'w-3/5'] as const;

/**
 * 분석이 끝나면 들어오는 본문 섹션(`NewsTextSection` — 구분선 + 라벨 + `text-sm leading-relaxed`
 * 문단)과 **같은 골격**의 자리 표시. 두 줄짜리 막대는 본문이 도착하는 순간 카드가 섹션 하나만큼
 * 자라 아래 카드들을 밀었다. 문단 세 줄은 **추정치**다 — 실제 줄 수는 기사·화면 폭마다 다르다.
 *
 * 텍스트가 없는 순수 장식이라 `aria-hidden`을 걸지 않는다. 로딩 안내는 카드의 분석 스켈레톤 문구가
 * 맡고, `NewsCardSkeleton`은 자기 `<article aria-hidden>` 안에서 이 골격을 재사용한다.
 */
export function NewsBodySkeleton() {
    return (
        <div className="mt-3 border-t border-secondary-700/70 pt-3">
            {/* 라벨(h4, text-xs = 16px 줄) */}
            <div className="mb-1 flex h-4 items-center">
                <div className="h-3 w-12 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
            {/* 문단(text-sm leading-relaxed ≈ 22.75px 줄) */}
            {/* 상수 폭 배열의 정적 줄이라 재정렬·삽입이 없다 — 인덱스 key로 충분하다(폭은 중복될 수 있다). */}
            {NEWS_BODY_SKELETON_LINE_WIDTHS.map((width, i) => (
                <div key={i} className="flex h-5.5 items-center">
                    <div
                        className={cn(
                            'h-3.5 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none',
                            width
                        )}
                    />
                </div>
            ))}
        </div>
    );
}
