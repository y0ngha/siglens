/**
 * 홈 히어로의 LCP 일러스트.
 */

import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface HeroIllustrationProps {
    readonly className?: string;
}

/**
 * Hero 영역 LCP 최적화용 SVG 일러스트 (외부 파일 + next/image).
 *
 * 인라인 SVG를 직접 JSX에 박으면 Chrome LCP 후보 선정 알고리즘이 SVG 내부
 * primitive(rect/path/text)를 개별 element로 분리해 평가한다. 각 primitive가
 * 본문 단락(`<p>`)보다 작아서 SVG bbox가 ~125k px²여도 LCP가 ~27k px²의
 * `<p>`로 잡히는 회귀가 관찰됐다 (Chrome 148, 414×896 viewport 기준).
 * 외부 SVG 파일을 `<img>`로 로드하면 단일 image LCP 후보가 되어 의도대로
 * SVG가 LCP가 된다.
 *
 * `preload`(Next 16에서 deprecated된 `priority`의 후속)로 next/image가 preload를 emit하지만, `unoptimized` SVG에는
 * `fetchpriority="high"`가 자동 부여되지 않는 케이스가 PSI `lcp-discovery-insight`
 * audit에서 0점으로 잡힌다(priorityHinted: false). 명시적으로 `fetchPriority="high"`를
 * 추가해 LCP 리소스의 load delay를 줄인다.
 * `unoptimized`로 next/image의 SVG 변환(불가능)을 우회한다.
 *
 * SVG 본체는 `public/hero-levels-v3.svg`에 정적 자산으로 둔다. 컨셉은
 * "가격대 지도"다 — 캔들 위에 지지 구간(음영 띠), 저항선(실선), 무효화 기준(점선)을 그린다.
 * 종목명·가격·등락률·지표 이름이 없는 결정적 디자인이라 실제 데이터를 흉내 내지 않고
 * 시간이 지나도 outdate되지 않는다(v2는 지어낸 시세와 골든크로스 마커가 있어 대체했다).
 *
 * 캔들 색은 실제 차트와 같아야 한다. 상승은 `shared/lib/chartColors.ts`의
 * `CHART_COLORS_RAW_DARK.bullish`, 하락은 `.bearish` 값이고, 지지·저항·무효화 선은
 * `supportLine`·`resistanceLine`·`actionStopLoss`다. `HeroIllustration.test.tsx`가
 * SVG가 그 값을 쓰는지 고정한다. 차트 색을 바꾸면 SVG와 그 테스트를 함께 고친다.
 * 자산은 `immutable`로 캐시되고 배포가 퍼지하지 않으므로, 내용을 바꿀 때는 파일 이름의
 * 버전(`-v3`)을 올린다.
 *
 * LCP: 데스크톱(`lg` 이상)에서는 일러스트가 여전히 LCP 후보라 `preload`와
 * `fetchPriority="high"`를 유지한다. 모바일에서는 `HomeHero`가 이 일러스트를 `hidden lg:block`로
 * 숨겨 LCP가 텍스트다 — preload는 3.6KB SVG 하나라 모바일 비용이 무시할 만하다.
 */
export function HeroIllustration({ className }: HeroIllustrationProps) {
    const t = useTranslations('widgets.home');
    return (
        <Image
            src="/hero-levels-v3.svg"
            alt={t('HeroIllustration.alt')}
            width={800}
            height={500}
            preload
            fetchPriority="high"
            unoptimized
            className={className}
        />
    );
}
