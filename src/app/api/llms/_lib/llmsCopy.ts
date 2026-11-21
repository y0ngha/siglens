import type { GuideCategory } from '@/entities/guide/types';
import type { FearGreedDataMarket } from '@/shared/config/fearGreedData';

/*
 * llms.txt 문구. 화면 페이지가 아니라 기계가 읽는 파일이고 로케일이 하나(ko)라서, RSS(`rss/sources.ts`)처럼
 * 번역 카탈로그가 아니라 리터럴로 둔다(`src/app/api/`는 i18n 스캐너 대상이 아니다).
 *
 * 규칙(`__tests__/llmsCopyRules.test.ts`가 강제한다): 줄표·가운뎃점·이모지 없음, 내부 용어 없음, 행동 권유
 * 표현 없음, 시간이 지나면 틀려지는 개수 없음. 각 설명은 해당 페이지의 메타 설명과 같은 사실만 말한다.
 */

export const MAIN_COPY = {
    title: '시그렌즈 (SIGLENS)',
    summary:
        '시그렌즈는 미국 주식, 한국 주식, 암호화폐의 종목마다 차트, 재무, 뉴스를 한곳에 모아 보는 무료 분석 서비스입니다. 차트 지표와 기술적 신호, 공포 탐욕 지수는 정해진 규칙으로 계산하고, AI는 계산된 값과 재무, 뉴스를 받아 설명하는 글을 쓰고 차트 구조를 읽어 참고 가격대를 제안합니다. 투자 권유가 아닌 정보 제공을 목적으로 합니다.',
    paragraphs: [
        'SIGLENS (siglens.io) is a free, primarily Korean-language analysis service for US stocks, Korean stocks and crypto. Indicators, signals and the fear and greed index are computed by fixed rules; AI writes the explanations and proposes reference price levels from the chart structure. It provides information, not investment advice.',
        '아래 주소는 모두 한국어 페이지이고 언어 접두사가 없습니다. 시세와 점수는 거래일마다 바뀌니 인용할 때는 페이지에 적힌 기준일을 함께 적어 주세요.',
    ],
    sections: {
        service: '서비스와 분석 방법',
        fearGreed: '공포 탐욕 지수',
        data: '데이터 파일',
        market: '시장과 경제',
        guide: '차트 가이드',
        subscribe: '구독',
        ai: '시그렌즈 AI',
        optional: 'Optional',
    },
    service: {
        about: {
            title: '시그렌즈 소개',
            note: '다루는 시장, 데이터 출처, 운영자, 한계',
        },
        methodology: {
            title: '분석 방법',
            note: '시장별 데이터 출처, 계산 규칙, AI가 맡는 일',
        },
        fearGreed: {
            title: '공포 탐욕 지수 계산 방법',
            note: '시장별 구성 지표와 점수 구간',
        },
        limits: {
            title: '분석의 한계',
            note: '분석이 틀릴 수 있는 경우',
        },
        corrections: {
            title: '오류 신고와 정정',
            note: '잘못된 값을 알리는 방법과 고치는 방식',
        },
        backtesting: {
            title: 'AI 분석 백테스트',
            note: 'AI 일일 분석을 과거 데이터에 적용한 결과와 한계',
        },
    },
    fearGreedMarkets: {
        us: {
            hubTitle: '미국 공포 탐욕 지수',
            hubNote: '미국 시장의 오늘 점수, 구성 지표, 지난 기록',
            dataName: '미국 공포 탐욕 지수 기록',
        },
        kr: {
            hubTitle: '코스피 공포 탐욕 지수',
            hubNote: '한국 시장의 오늘 점수, 구성 지표, 지난 기록',
            dataName: '코스피 공포 탐욕 지수 기록',
        },
        crypto: {
            hubTitle: '코인 공포 탐욕 지수',
            hubNote: '암호화폐 시장의 오늘 점수, 구성 지표, 지난 기록',
            dataName: '코인 공포 탐욕 지수 기록',
        },
    } satisfies Record<
        FearGreedDataMarket,
        { hubTitle: string; hubNote: string; dataName: string }
    >,
    fearGreedFormatNote: {
        csv: '날짜, 점수(0~100), 구간 코드',
        json: '같은 기록에 기준일, 시간대, 출처, 이용 조건을 더한 파일',
    },
    dataFiles: {
        backtestJson: {
            title: '백테스트 실행 데이터 (JSON)',
            note: '백테스트 페이지가 쓰는 실행 정보, 비교 기준, 거래 목록',
        },
        trades: {
            title: '백테스트 거래 기록 (CSV)',
            note: '거래마다 진입일, 청산일, 수익률, 청산 이유',
        },
        decisions: {
            title: '백테스트 일별 판단 기록 (CSV)',
            note: 'AI를 부른 종목과 날짜마다 응답에서 읽은 계획과 이후 5거래일, 10거래일 수익률',
        },
        readme: {
            title: '백테스트 결과 설명',
            note: '실행 조건, 결과 요약, 파일 설명',
        },
        benchmarkZip: {
            title: '주식 AI 벤치마크 원자료 (ZIP)',
            note: '문항, 정답, 답변 원문, 채점 결과',
        },
    },
    market: {
        us: {
            title: '오늘의 미국 주식',
            note: '섹터별 기술적 신호와 시장 브리핑',
        },
        kr: {
            title: '오늘의 한국 주식',
            note: '코스피와 코스닥의 섹터별 기술적 신호와 시장 브리핑',
        },
        economyUs: {
            title: '미국 경제',
            note: '금리, 물가, 고용, 성장 지표와 경제 발표 일정, 거시 브리핑',
        },
        economyKr: {
            title: '한국 경제',
            note: '기준금리, 물가, 고용, 성장률 같은 국내 지표와 발표 일정',
        },
        news: {
            title: '시장 뉴스',
            note: '시장별 뉴스와 카테고리별 AI 요약',
        },
        symbols: {
            title: '많이 찾는 종목',
            note: '종목 페이지로 가는 목록',
        },
        nvda: {
            title: '엔비디아 종목 페이지',
            note: '종목 페이지 주소는 사이트 주소 뒤에 종목 코드를 붙인 형태입니다',
        },
        samsung: {
            title: '삼성전자 종목 페이지',
            note: '한국 종목 코드에는 코스피 .KS, 코스닥 .KQ가 붙습니다',
        },
    },
    guideHub: {
        title: '차트 가이드',
        note: '캔들 패턴, 차트 패턴, 보조지표, 전략과 이론 용어와 실전 가이드 목록',
    },
    guideCategories: {
        howto: {
            title: '실전 가이드',
            note: '차트를 볼 때 자주 묻는 질문에 단계별로 답한 글',
        },
        candlesticks: {
            title: '캔들 패턴',
            note: '캔들 패턴의 모양과 뜻',
        },
        'chart-patterns': {
            title: '차트 패턴',
            note: '차트 패턴의 모양과 보는 법',
        },
        indicators: {
            title: '보조지표',
            note: '보조지표의 계산법과 읽는 법',
        },
        strategies: {
            title: '전략과 이론',
            note: '차트 분석에 쓰는 전략과 이론 용어',
        },
    } satisfies Record<GuideCategory, { title: string; note: string }>,
    rss: {
        title: '시장 브리핑 RSS',
        note: '미국과 한국 시장 브리핑, 거시 경제 브리핑, 뉴스 요약의 최신 글',
    },
    ai: {
        home: {
            title: '시그렌즈 AI',
            note: '시그렌즈가 모은 시세와 계산한 지표, 분석, 뉴스를 바탕으로 주식 질문에 답하는 대화형 서비스',
        },
        about: {
            title: '시그렌즈 AI 소개',
            note: '답을 만드는 방식과 예시 대화',
        },
        benchmark: {
            title: '주식 AI 정확도 벤치마크',
            note: '같은 주식 질문을 여러 AI에 묻고 시세와 공시로 만든 정답과 비교한 결과',
        },
        llms: {
            title: '시그렌즈 AI 안내 파일',
            note: '시그렌즈 AI의 페이지와 벤치마크 자료 목록',
        },
        llmsNoBenchmark: {
            title: '시그렌즈 AI 안내 파일',
            note: '시그렌즈 AI의 페이지 목록',
        },
    },
    optional: {
        terms: { title: '이용약관' },
        privacy: { title: '개인정보처리방침' },
        developers: { title: '개발자 안내', note: '공개 API 문서' },
    },
} as const;

export const AI_COPY = {
    title: '시그렌즈 AI (SIGLENS AI)',
    summary:
        '시그렌즈 AI는 시그렌즈가 모은 시세와 직접 계산한 차트 지표, 분석 리포트, 뉴스를 바탕으로 미국 주식, 한국 주식, 암호화폐 질문에 답하는 대화형 서비스입니다. 로그인하지 않아도 하루 정해진 횟수까지 질문할 수 있고, 투자 권유가 아닌 정보 제공을 목적으로 합니다.',
    paragraphs: [
        'SIGLENS AI (ai.siglens.io) is a primarily Korean-language chat assistant for US stocks, Korean stocks and crypto. It answers from market data, indicators and analyses prepared by SIGLENS, and it provides information, not investment advice.',
    ],
    sections: {
        ai: '시그렌즈 AI',
        benchmark: '벤치마크',
        main: '시그렌즈',
    },
    home: {
        title: '시그렌즈 AI',
        note: '질문을 입력하는 첫 화면',
    },
    about: {
        title: '시그렌즈 AI 소개',
        note: '답을 만드는 방식과 예시 대화',
    },
    benchmark: {
        page: {
            title: '주식 AI 정확도 벤치마크',
            note: '같은 주식 질문을 여러 AI에 묻고 시세와 공시로 만든 정답과 비교한 결과',
        },
        zip: {
            title: '벤치마크 원자료 (ZIP)',
            note: '문항, 정답, 답변 원문, 채점 결과',
        },
        prereg: {
            title: '사전 등록 기록',
            note: '측정 전에 문항, 채점 코드, 측정할 제품 버전의 해시를 남긴 기록',
        },
    },
    main: {
        home: {
            title: '시그렌즈',
            note: '미국, 한국 주식과 암호화폐 분석',
        },
        methodology: {
            title: '분석 방법',
            note: '데이터 출처와 계산 규칙',
        },
        llms: {
            title: '시그렌즈 안내 파일',
            note: '공포 탐욕 지수 데이터 파일, 차트 가이드, 시장 페이지 목록',
        },
    },
} as const;
