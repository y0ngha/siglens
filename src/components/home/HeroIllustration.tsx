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
 * `priority`로 next/image가 preload를 emit하지만, `unoptimized` SVG에는
 * `fetchpriority="high"`가 자동 부여되지 않는 케이스가 PSI `lcp-discovery-insight`
 * audit에서 0점으로 잡혔다(priorityHinted: false). 명시적으로 `fetchPriority="high"`를
 * 추가해 Resource load delay 1.7s 단축을 노린다.
 * `unoptimized`로 next/image의 SVG 변환(불가능)을 우회한다.
 *
 * SVG 본체는 `public/hero-dashboard.svg`에 정적 자산으로 둔다. 컨셉
 * (캔들 차트 + MA 추세 + 골든크로스 마커 + RSI 서브패널)을 추상화한
 * 결정적 디자인이라 실제 데이터에 의존하지 않고 시간이 지나도 outdate되지
 * 않는다. 색상 토큰 매핑은 SVG 파일 상단 주석에 따로 기록하지 않고, 변경
 * 시에는 globals.css `@theme` token과 함께 일관되게 갱신해야 한다.
 */
export function HeroIllustration({ className }: HeroIllustrationProps) {
    return (
        <Image
            src="/hero-dashboard.svg"
            alt="캔들 차트와 보조지표 추세선, 골든크로스 신호 마커, RSI 서브패널이 표시된 분석 대시보드 일러스트"
            width={800}
            height={500}
            priority
            fetchPriority="high"
            unoptimized
            className={className}
        />
    );
}
