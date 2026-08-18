import type { SkillCounts } from '@y0ngha/siglens-core';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';

/**
 * 홈의 FAQ·HowTo JSON-LD.
 *
 * **왜 page.tsx 밖으로 뺐는가**: 이 두 블록은 사이트가 어떤 자산군을 다루는지
 * 프로즈로 선언하는 표면이고, 같은 선언이 `ROOT_TITLE`·`SITE_DESCRIPTION`·
 * `ROOT_KEYWORDS`·OG alt에도 각각 흩어져 있다. 한국 상장 종목을 추가하면서 그중
 * 일부만 고치는 일이 세 라운드 연속 반복됐다(MISTAKES.md §6.6). 컴포넌트 본문
 * 안에 있으면 렌더 없이는 검사할 수 없어 테스트로 동기화를 강제할 수가 없다 —
 * 모듈로 빼서 `supportedAssets.test.ts`가 모든 표면을 한 번에 검사한다.
 */
export const HOME_FAQ_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: `${SITE_NAME}는 어떤 서비스인가요?`,
            acceptedAnswer: {
                '@type': 'Answer',
                text: '미국 주식 티커를 입력하면 차트(보조지표와 캔들 패턴, 지지선과 저항선), 실적과 밸류에이션, 재무제표, 최근 뉴스 흐름, 옵션 시장 데이터, 공직자 매매 공시, 그리고 단기 매수 분위기(공포 탐욕 지수)까지 각각 정리하고 이걸 묶은 종합 결론까지 보여주는 무료 웹 서비스입니다. 코스피·코스닥 국내 상장 종목은 차트·실적·재무제표·뉴스·공포 탐욕 지수·종합 결론을 제공합니다(국내에는 공직자 매매 공시 제도와 개별 종목 옵션 시장이 없어 그 두 축은 제외됩니다). 비트코인·이더리움 같은 암호화폐는 차트·뉴스·공포 탐욕 지수·종합 결론을 제공합니다. 회원가입 없이 바로 이용할 수 있습니다.',
            },
        },
        {
            '@type': 'Question',
            name: 'AI 대화로 무엇을 물어볼 수 있나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Siglens 챗봇은 현재 보고 있는 종목의 차트와 지표 데이터를 맥락으로, 추세 해석, 진입 타이밍, 지표 의미, 패턴 비교, 전략 토론 같은 질문에 답합니다. 답변은 화면에 표시된 분석 결과를 근거로 생성됩니다.',
            },
        },
        {
            '@type': 'Question',
            name: '오늘의 시장 현황에서 어떤 신호를 볼 수 있나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Siglens의 /market 페이지에서는 11개 섹터의 선도 종목을 매일 스캔해 골든크로스, 데드크로스, RSI 다이버전스, 볼린저 스퀴즈 같은 기술적 신호가 포착된 티커를 정리해 보여줍니다. 관심 종목을 클릭하면 해당 티커의 상세 AI 분석 페이지로 이동합니다.',
            },
        },
        {
            '@type': 'Question',
            name: '특정 종목의 PER이나 ROE 같은 실적 지표는 어디서 보나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '종목 페이지의 펀더멘털 탭에서 PER, PBR, ROE, 영업이익률 같은 밸류에이션과 수익성 지표, 동종 업계 평균 비교를 함께 볼 수 있습니다. 예를 들어 애플이라면 /AAPL/fundamental 경로에서 확인합니다.',
            },
        },
        {
            '@type': 'Question',
            name: '어닝과 실적 발표나 뉴스 분위기를 확인하고 싶을 때는 어디로 가야 하나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '종목 페이지의 뉴스 탭에서 최근 어닝과 실적 결과, 가이던스, 주요 이벤트와 함께 뉴스 분위기(호재, 중립, 악재 분포)를 정리해 보여줍니다. 예를 들어 테슬라는 /TSLA/news 경로이며, 차트만으로 설명되지 않는 가격 움직임을 점검할 때 유용합니다.',
            },
        },
        {
            '@type': 'Question',
            name: '지금 이 종목에 매수세가 강한지도 알 수 있나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '각 종목 페이지의 공포 탐욕 지수 탭(예: /AAPL/fear-greed)에서 거래량 흐름과 가격 위치를 묶어 0~100 점수로 단기 분위기를 확인합니다. 0에 가까울수록 매도세, 100에 가까울수록 매수세가 강하다는 뜻이고, 5단계 라벨로 극심한 공포부터 극심한 탐욕까지 보여줍니다.',
            },
        },
        {
            '@type': 'Question',
            name: '개별 종목 말고 미국 증시 전체 분위기는 어디서 보나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '시장 전체 공포탐욕지수 페이지(/fear-greed)에서 S&P500, VIX, 장기국채, 하이일드·투자등급 회사채, 동일가중 지수 5개 요인을 묶어 미국 증시 전체의 단기 매수 심리를 0~100 점수로 보여줍니다. 종목별 지수가 한 종목의 수급을 본다면, 이 페이지는 시장 전반이 과열인지 공포인지를 봅니다.',
            },
        },
        {
            '@type': 'Question',
            name: '옵션 시장에서 기관이나 큰손들이 어디에 베팅하고 있는지 알 수 있나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '각 종목 페이지의 옵션 분석 탭(예: /AAPL/options)에서 만기별 Max Pain, Put/Call Ratio, ATM IV, Implied Move와 Strike별 Open Interest 분포를 확인할 수 있습니다. AI가 이 복잡한 옵션 데이터를 한국어로 해석해 시장의 베팅 방향을 설명해 줍니다.',
            },
        },
        {
            '@type': 'Question',
            name: '차트와 실적, 뉴스, 옵션을 합친 결론은 어디서 볼 수 있나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '종목 페이지의 종합 분석 탭에서 차트, 실적, 뉴스, 옵션 시장, 공포 탐욕 지수를 묶어 강세와 약세 시나리오, 핵심 점검 포인트, 위험 요인을 함께 정리한 결론을 확인할 수 있습니다. 예를 들어 엔비디아는 /NVDA/overall 경로입니다.',
            },
        },
        {
            '@type': 'Question',
            name: 'AI 분석이 실제로 얼마나 맞는지 궁금할 때는요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '/backtesting 페이지에서 주요 종목을 대상으로 한 2년치 기술적 분석과 AI 예측의 적중률, 누적 수익률 시뮬레이션을 공개하고 있어 분석 결과를 신뢰할지 판단할 때 참고할 수 있습니다.',
            },
        },
        {
            '@type': 'Question',
            name: '서비스 이용 요금이 있나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '현재는 회원가입 없이 무료로 제공됩니다. 향후 고급 기능은 유료 플랜으로 제공될 예정이며, 기본 분석은 계속 무료로 이용할 수 있습니다.',
            },
        },
        {
            '@type': 'Question',
            name: '암호화폐도 분석할 수 있나요?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '비트코인(BTCUSD), 이더리움(ETHUSD) 등 주요 암호화폐도 종목처럼 분석합니다. 티커를 입력하면 24시간 가격 차트와 보조지표, 매매 신호, 최신 크립토 뉴스, 공포 탐욕 지수, 그리고 이를 묶은 AI 종합 결론까지 확인할 수 있습니다. 예: /BTCUSD.',
            },
        },
    ],
};

interface HomeHowToJsonLd {
    '@context': string;
    '@type': 'HowTo';
    name: string;
    description: string;
    step: Array<{
        '@type': 'HowToStep';
        name: string;
        text: string;
        url: string;
    }>;
    // `<JsonLd data>`가 `Record<string, unknown>`을 요구한다 — 인덱스 시그니처가
    // 없으면 이 인터페이스를 그 자리에 넘길 수 없다. 필드별 타입(`name: string` 등)은
    // 이 시그니처보다 좁으므로 구조적으로 여전히 유효하다.
    [key: string]: unknown;
}

/**
 * `Record<string, unknown>` 대신 이름 있는 인터페이스를 쓴다 — 자산군 커버리지
 * 테스트(`supportedAssets.test.ts`)가 `name`·`description`을 문자열로 읽어
 * `missingAssetMentions`에 넘기는데, `Record<string, unknown>`이면 그 필드가
 * `unknown`으로 넓어져 캐스트 없이는 타입체크를 통과할 수 없다.
 */
export function buildHomeHowToJsonLd(
    skillCounts: SkillCounts
): HomeHowToJsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: `${SITE_NAME}로 미국·한국 주식과 암호화폐를 차트, 뉴스, 공포 탐욕 지수로 살펴보고 종합 결론까지 받는 방법`,
        description: `${SITE_NAME}에서 미국 주식, 코스피·코스닥 국내 종목, 암호화폐를 차트, 뉴스, 공포 탐욕 지수로 살펴보고 이를 묶은 종합 결론과 시나리오를 받는 흐름입니다. 미국 주식에는 실적·재무제표·옵션 시장·의회 거래 공시가, 국내 종목에는 실적·재무제표가 더해집니다.`,
        step: [
            {
                '@type': 'HowToStep',
                name: '종목명이나 심볼 입력',
                text: '분석하고 싶은 종목의 이름이나 심볼을 검색창에 입력합니다. 예: 애플, 테슬라, AAPL, TSLA, 국내 종목은 삼성전자, 005930.KS, 암호화폐는 BTCUSD, ETHUSD.',
                url: `${SITE_URL}/#search`,
            },
            {
                '@type': 'HowToStep',
                name: '차트 분석 살펴보기',
                text: `종목 페이지에서 보조지표 ${skillCounts.indicators}종, 캔들 패턴 ${skillCounts.candlesticks}종, 차트 패턴 ${skillCounts.patterns}종, 전략 ${skillCounts.strategies}종, 지지선과 저항선 레벨 ${skillCounts.supportResistance}종 기준으로 추세와 진입 후보 구간을 살펴봅니다.`,
                url: `${SITE_URL}/AAPL`,
            },
            {
                '@type': 'HowToStep',
                name: '실적과 뉴스로 보강하기',
                text: '종목 페이지의 펀더멘털 탭에서 PER, PBR, ROE 같은 밸류에이션과 수익성 지표를, 뉴스 탭에서 어닝과 실적 발표, 뉴스 분위기를 확인해 차트가 보여주지 않는 배경을 보강합니다. 예: /AAPL/fundamental, /AAPL/news.',
                url: `${SITE_URL}/AAPL/fundamental`,
            },
            {
                '@type': 'HowToStep',
                name: '옵션 시장 베팅 확인',
                text: '옵션 분석 탭(예: /AAPL/options)에서 Max Pain, Put/Call Ratio와 Open Interest 분포를 확인해 기관이나 큰손 투자자들이 향후 주가를 어떻게 예상하고 있는지 확인합니다.',
                url: `${SITE_URL}/AAPL/options`,
            },
            {
                '@type': 'HowToStep',
                name: '단기 매수 분위기 확인',
                text: '공포 탐욕 지수 탭(예: /AAPL/fear-greed)에서 단기 매수세가 강한지 약한지를 0~100 점수와 5단계 분위기로 확인합니다. 차트가 좋아 보여도 분위기가 너무 과열이면 진입 타이밍을 한 번 더 따져볼 수 있습니다.',
                url: `${SITE_URL}/AAPL/fear-greed`,
            },
            {
                '@type': 'HowToStep',
                name: '종합 결론 확인',
                text: '종합 분석 탭(예: /AAPL/overall)에서 차트, 실적, 뉴스, 옵션, 공포 탐욕 지수를 묶은 종합 결론과 강세, 약세 시나리오, 점검 포인트, 위험 요인을 함께 확인합니다.',
                url: `${SITE_URL}/AAPL/overall`,
            },
            {
                '@type': 'HowToStep',
                name: 'AI에게 추가 질문',
                text: '판단이 애매할 때는 챗봇에게 직접 질문할 수 있습니다. 현재 보고 있는 종목 데이터를 맥락으로, 지표 해석, 시나리오 비교, 매매 전략 같은 질문에 답변을 받습니다.',
                url: `${SITE_URL}/AAPL#chat`,
            },
        ],
    };
}
