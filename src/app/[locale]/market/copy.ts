import { clampSeoDescription, ROOT_KEYWORDS } from '@/shared/lib/seo';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/**
 * 시장별 `/market` 라우트 카피 — 메타데이터·h1·JSON-LD의 단일 소스.
 *
 * 두 라우트가 같은 구조를 그리고 문장만 다르므로, 라우트마다 복사하면 한쪽만
 * 갱신된다. 특히 `title`은 h1과 metadata.title, JSON-LD `name`에 동시에 쓰인다.
 */
export interface MarketCopy {
    readonly path: string;
    /** Root layout이 `| Siglens`를 붙이므로 브랜드명을 넣지 않는다. */
    readonly title: string;
    readonly description: string;
    readonly keywords: readonly string[];
    /** breadcrumb 마지막 마디. */
    readonly breadcrumb: string;
    /** ItemList 구조화데이터의 이름. */
    readonly itemListName: string;
}

export const MARKET_COPY: Record<DashboardScopeId, MarketCopy> = {
    us: {
        path: '/market',
        title: '오늘의 미국 주식, 섹터별 기술적 신호',
        // clampSeoDescription으로 SEO_DESCRIPTION_MAX_LENGTH(120자)를 출력단에서 강제 —
        // 한글 SERP 절단 방지 + 향후 텍스트 수정 시 한도 초과 drift 차단(MISTAKES §15).
        // 섹터 개수는 표기하지 않는다(11 GICS ETF + 양자 테마라 단일 숫자가 모호).
        description: clampSeoDescription(
            '오늘 미국 주식 시장을 섹터별로 나눠 봅니다. AI 반도체·빅테크·헬스케어 등에서 골든크로스, RSI 다이버전스, 볼린저 스퀴즈 신호가 잡힌 종목을 추려 AI 분석으로 연결합니다.'
        ),
        keywords: [
            ...ROOT_KEYWORDS,
            '미국 주식 시장 개요',
            '오늘의 종목',
            '오늘 매수 종목',
            '거래량 급증',
            '장중 신호',
            '섹터 ETF 신호',
            'AI 반도체 종목',
            '빅테크 종목',
            '헬스케어 종목',
            '골든크로스 스캐너',
            'RSI 다이버전스',
            '볼린저 스퀴즈',
        ],
        breadcrumb: '미국 시장 현황',
        itemListName: '미국 주식 섹터·테마별 신호 스캐너',
    },
    kr: {
        path: '/market/kr',
        title: '오늘의 한국 주식, 섹터별 기술적 신호',
        description: clampSeoDescription(
            '오늘 코스피·코스닥을 섹터별로 나눠 봅니다. 반도체·2차전지·바이오 등에서 골든크로스, RSI 다이버전스, 볼린저 스퀴즈 신호가 잡힌 종목을 추려 AI 분석으로 연결합니다.'
        ),
        keywords: [
            ...ROOT_KEYWORDS,
            '코스피 오늘',
            '코스닥 오늘',
            '한국 주식 시장 개요',
            '오늘 매수 종목',
            '국내 증시 신호',
            '반도체 종목',
            '2차전지 종목',
            '바이오 종목',
            '골든크로스 스캐너',
            'RSI 다이버전스',
            '볼린저 스퀴즈',
        ],
        breadcrumb: '한국 시장 현황',
        itemListName: '한국 주식 섹터별 신호 스캐너',
    },
};
