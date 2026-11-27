import {
    TEST_RUN_ID,
    testInputs,
} from '@/app/api/llms/_lib/__tests__/llmsTestInputs';
import {
    buildLlmsDocument,
    llmsTargetUrl,
} from '@/app/api/llms/_lib/buildLlmsDocument';
import type { LlmsDocument } from '@/app/api/llms/_lib/model';
import { renderLlmsTxt } from '@/app/api/llms/_lib/renderLlmsTxt';
import { backtestResultsFileUrl } from '@/entities/backtest-case/lib/resultsFileUrl';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import { GUIDE_CATEGORIES } from '@/entities/guide/types';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import {
    FEAR_GREED_DATA_FORMATS,
    FEAR_GREED_DATA_MARKETS,
    fearGreedDataPath,
} from '@/shared/config/fearGreedData';
import { SITE_URL } from '@/shared/lib/seo';

const RELEASE = getPublishedBenchmarkRelease();

function headings(doc: LlmsDocument): string[] {
    return doc.sections.map(s => s.heading);
}
function urls(doc: LlmsDocument): string[] {
    return doc.sections.flatMap(s => s.links.map(l => l.url));
}
function section(doc: LlmsDocument, heading: string) {
    return doc.sections.find(s => s.heading === heading);
}

const MAIN_BODY = `# 시그렌즈 (SIGLENS)

> 시그렌즈는 미국 주식, 한국 주식, 암호화폐의 종목마다 차트, 재무, 뉴스를 한곳에 모아 보는 무료 분석 서비스입니다. 차트 지표와 기술적 신호, 공포 탐욕 지수는 정해진 규칙으로 계산하고, AI는 계산된 값과 재무, 뉴스를 받아 설명하는 글을 쓰고 차트 구조를 읽어 참고 가격대를 제안합니다. 투자 권유가 아닌 정보 제공을 목적으로 합니다.

SIGLENS (siglens.io) is a free, primarily Korean-language analysis service for US stocks, Korean stocks and crypto. Indicators, signals and the fear and greed index are computed by fixed rules; AI writes the explanations and proposes reference price levels from the chart structure. It provides information, not investment advice.

아래 주소는 모두 한국어 페이지이고 언어 접두사가 없습니다. 시세와 점수는 거래일마다 바뀌니 인용할 때는 페이지에 적힌 기준일을 함께 적어 주세요.

## 서비스와 분석 방법

- [시그렌즈 소개](https://siglens.io/about): 다루는 시장, 데이터 출처, 운영자, 한계
- [분석 방법](https://siglens.io/methodology): 시장별 데이터 출처, 계산 규칙, AI가 맡는 일
- [공포 탐욕 지수 계산 방법](https://siglens.io/methodology#fear-greed): 시장별 구성 지표와 점수 구간
- [분석의 한계](https://siglens.io/methodology#limits): 분석이 틀릴 수 있는 경우
- [오류 신고와 정정](https://siglens.io/methodology#corrections): 잘못된 값을 알리는 방법과 고치는 방식
- [AI 분석 백테스트](https://siglens.io/backtesting): AI 일일 분석을 과거 데이터에 적용한 결과와 한계

## 공포 탐욕 지수

- [미국 공포 탐욕 지수](https://siglens.io/fear-greed): 미국 시장의 오늘 점수, 구성 지표, 지난 기록
- [코스피 공포 탐욕 지수](https://siglens.io/fear-greed/kr): 한국 시장의 오늘 점수, 구성 지표, 지난 기록
- [코인 공포 탐욕 지수](https://siglens.io/fear-greed/crypto): 암호화폐 시장의 오늘 점수, 구성 지표, 지난 기록

## 데이터 파일

- [미국 공포 탐욕 지수 기록 (CSV)](https://siglens.io/fear-greed/data.csv): 날짜, 점수(0~100), 구간 코드
- [미국 공포 탐욕 지수 기록 (JSON)](https://siglens.io/fear-greed/data.json): 같은 기록에 기준일, 시간대, 출처, 이용 조건을 더한 파일
- [코스피 공포 탐욕 지수 기록 (CSV)](https://siglens.io/fear-greed/kr/data.csv): 날짜, 점수(0~100), 구간 코드
- [코스피 공포 탐욕 지수 기록 (JSON)](https://siglens.io/fear-greed/kr/data.json): 같은 기록에 기준일, 시간대, 출처, 이용 조건을 더한 파일
- [코인 공포 탐욕 지수 기록 (CSV)](https://siglens.io/fear-greed/crypto/data.csv): 날짜, 점수(0~100), 구간 코드
- [코인 공포 탐욕 지수 기록 (JSON)](https://siglens.io/fear-greed/crypto/data.json): 같은 기록에 기준일, 시간대, 출처, 이용 조건을 더한 파일
- [백테스트 실행 데이터 (JSON)](https://siglens.io/backtesting/data.json): 백테스트 페이지가 쓰는 실행 정보, 비교 기준, 거래 목록
- [백테스트 거래 기록 (CSV)](https://raw.githubusercontent.com/y0ngha/siglens/master/backtest-results/${TEST_RUN_ID}/trades.csv): 거래마다 진입일, 청산일, 수익률, 청산 이유
- [백테스트 일별 판단 기록 (CSV)](https://raw.githubusercontent.com/y0ngha/siglens/master/backtest-results/${TEST_RUN_ID}/decisions.csv): AI를 부른 종목과 날짜마다 응답에서 읽은 계획과 이후 5거래일, 10거래일 수익률
- [백테스트 결과 설명](https://raw.githubusercontent.com/y0ngha/siglens/master/backtest-results/${TEST_RUN_ID}/README.ko.md): 실행 조건, 결과 요약, 파일 설명
- [주식 AI 벤치마크 원자료 (ZIP)](https://ai.siglens.io/benchmark/2026-10/benchmark-2026-10.zip): 문항, 정답, 답변 원문, 채점 결과

## 시장과 경제

- [오늘의 미국 주식](https://siglens.io/market): 섹터별 기술적 신호와 시장 브리핑
- [오늘의 한국 주식](https://siglens.io/market/kr): 코스피와 코스닥의 섹터별 기술적 신호와 시장 브리핑
- [미국 경제](https://siglens.io/economy): 금리, 물가, 고용, 성장 지표와 경제 발표 일정, 거시 브리핑
- [한국 경제](https://siglens.io/economy/kr): 기준금리, 물가, 고용, 성장률 같은 국내 지표와 발표 일정
- [시장 뉴스](https://siglens.io/news): 시장별 뉴스와 카테고리별 AI 요약
- [많이 찾는 종목](https://siglens.io/symbols): 종목 페이지로 가는 목록
- [엔비디아 종목 페이지](https://siglens.io/NVDA): 종목 페이지 주소는 사이트 주소 뒤에 종목 코드를 붙인 형태입니다
- [삼성전자 종목 페이지](https://siglens.io/005930.KS): 한국 종목 코드에는 코스피 .KS, 코스닥 .KQ가 붙습니다

## 차트 가이드

- [차트 가이드](https://siglens.io/guide): 캔들 패턴, 차트 패턴, 보조지표, 전략과 이론 용어와 실전 가이드 목록
- [실전 가이드](https://siglens.io/guide/howto): 차트를 볼 때 자주 묻는 질문에 단계별로 답한 글
- [캔들 패턴](https://siglens.io/guide/candlesticks): 캔들 패턴의 모양과 뜻
- [차트 패턴](https://siglens.io/guide/chart-patterns): 차트 패턴의 모양과 보는 법
- [보조지표](https://siglens.io/guide/indicators): 보조지표의 계산법과 읽는 법
- [전략과 이론](https://siglens.io/guide/strategies): 차트 분석에 쓰는 전략과 이론 용어

## 구독

- [시장 브리핑 RSS](https://siglens.io/rss.xml): 미국과 한국 시장 브리핑, 거시 경제 브리핑, 뉴스 요약의 최신 글

## 시그렌즈 AI

- [시그렌즈 AI](https://ai.siglens.io/): 시그렌즈가 모은 시세와 계산한 지표, 분석, 뉴스를 바탕으로 주식 질문에 답하는 대화형 서비스
- [시그렌즈 AI 소개](https://ai.siglens.io/about): 답을 만드는 방식과 예시 대화
- [주식 AI 정확도 벤치마크](https://ai.siglens.io/benchmark): 같은 주식 질문을 여러 AI에 묻고 시세와 공시로 만든 정답과 비교한 결과
- [시그렌즈 AI 안내 파일](https://ai.siglens.io/llms.txt): 시그렌즈 AI의 페이지와 벤치마크 자료 목록

## Optional

- [이용약관](https://siglens.io/terms)
- [개인정보처리방침](https://siglens.io/privacy)
`;

const AI_BODY = `# 시그렌즈 AI (SIGLENS AI)

> 시그렌즈 AI는 시그렌즈가 모은 시세와 직접 계산한 차트 지표, 분석 리포트, 뉴스를 바탕으로 미국 주식, 한국 주식, 암호화폐 질문에 답하는 대화형 서비스입니다. 로그인하지 않아도 하루 정해진 횟수까지 질문할 수 있고, 투자 권유가 아닌 정보 제공을 목적으로 합니다.

SIGLENS AI (ai.siglens.io) is a primarily Korean-language chat assistant for US stocks, Korean stocks and crypto. It answers from market data, indicators and analyses prepared by SIGLENS, and it provides information, not investment advice.

## 시그렌즈 AI

- [시그렌즈 AI](https://ai.siglens.io/): 질문을 입력하는 첫 화면
- [시그렌즈 AI 소개](https://ai.siglens.io/about): 답을 만드는 방식과 예시 대화

## 벤치마크

- [주식 AI 정확도 벤치마크](https://ai.siglens.io/benchmark): 같은 주식 질문을 여러 AI에 묻고 시세와 공시로 만든 정답과 비교한 결과
- [벤치마크 원자료 (ZIP)](https://ai.siglens.io/benchmark/2026-10/benchmark-2026-10.zip): 문항, 정답, 답변 원문, 채점 결과
- [사전 등록 기록](https://gist.github.com/y0ngha/297805050992a16aca81bcef0d9a5f5e): 측정 전에 문항, 채점 코드, 측정할 제품 버전의 해시를 남긴 기록

## 시그렌즈

- [시그렌즈](https://siglens.io/): 미국, 한국 주식과 암호화폐 분석
- [분석 방법](https://siglens.io/methodology): 데이터 출처와 계산 규칙
- [시그렌즈 안내 파일](https://siglens.io/llms.txt): 공포 탐욕 지수 데이터 파일, 차트 가이드, 시장 페이지 목록
`;

describe('buildLlmsDocument main', () => {
    it('벤치마크 공개 중, 공개 API 꺼짐: 섹션이 정해진 순서로 나온다', () => {
        const doc = buildLlmsDocument('main', testInputs());

        expect(headings(doc)).toEqual([
            '서비스와 분석 방법',
            '공포 탐욕 지수',
            '데이터 파일',
            '시장과 경제',
            '차트 가이드',
            '구독',
            '시그렌즈 AI',
            'Optional',
        ]);
    });

    it('데이터 파일의 공포 탐욕 기록 여섯 개는 경로 헬퍼가 만든 주소와 같다', () => {
        const doc = buildLlmsDocument('main', testInputs());

        const expected = FEAR_GREED_DATA_MARKETS.flatMap(market =>
            FEAR_GREED_DATA_FORMATS.map(
                format => `${SITE_URL}${fearGreedDataPath(market, format)}`
            )
        );
        expect(
            section(doc, '데이터 파일')
                ?.links.slice(0, expected.length)
                .map(l => l.url)
        ).toEqual(expected);
    });

    it('차트 가이드는 허브 하나와 카테고리마다 링크 하나를 같은 순서로 낸다', () => {
        const doc = buildLlmsDocument('main', testInputs());

        expect(section(doc, '차트 가이드')?.links.map(l => l.url)).toEqual([
            `${SITE_URL}/guide`,
            ...GUIDE_CATEGORIES.map(c => `${SITE_URL}/guide/${c}`),
        ]);
    });

    it('공개 API가 꺼져 있으면 /developers를 싣지 않는다', () => {
        const doc = buildLlmsDocument('main', testInputs());

        expect(urls(doc)).not.toContain(`${SITE_URL}/developers`);
    });

    it('공개 API가 켜져 있으면 Optional에 /developers를 싣는다', () => {
        const doc = buildLlmsDocument(
            'main',
            testInputs({ publicApiEnabled: true })
        );

        expect(section(doc, 'Optional')?.links.map(l => l.url)).toEqual([
            `${SITE_URL}/terms`,
            `${SITE_URL}/privacy`,
            `${SITE_URL}/developers`,
        ]);
    });

    it('벤치마크가 없으면 ZIP과 /benchmark 링크를 싣지 않는다', () => {
        const doc = buildLlmsDocument('main', testInputs({ benchmark: null }));

        const all = urls(doc);
        expect(all.some(u => u.endsWith('.zip'))).toBe(false);
        expect(all.some(u => u.includes('/benchmark'))).toBe(false);
    });

    it('벤치마크가 없으면 ai 안내 파일 설명에 벤치마크를 말하지 않는다', () => {
        const text = renderLlmsTxt(
            buildLlmsDocument('main', testInputs({ benchmark: null }))
        );

        expect(text).not.toContain('벤치마크');
        expect(text).toContain(
            '- [시그렌즈 AI 안내 파일](https://ai.siglens.io/llms.txt): 시그렌즈 AI의 페이지 목록'
        );
    });

    it('백테스트 CSV와 README 주소는 입력의 실행 id로 만든 값과 같다', () => {
        const doc = buildLlmsDocument(
            'main',
            testInputs({ backtestRunId: 'run-x' })
        );

        expect(urls(doc)).toEqual(
            expect.arrayContaining([
                backtestResultsFileUrl('run-x', 'trades.csv'),
                backtestResultsFileUrl('run-x', 'decisions.csv'),
                backtestResultsFileUrl('run-x', 'README.ko.md'),
            ])
        );
    });

    it('본문 전체가 계약과 같다 (문구 변경은 의도해서만)', () => {
        const text = renderLlmsTxt(buildLlmsDocument('main', testInputs()));

        expect(text).toBe(MAIN_BODY);
    });
});

describe('buildLlmsDocument ai', () => {
    it('섹션은 시그렌즈 AI, 벤치마크, 시그렌즈 순이다', () => {
        const doc = buildLlmsDocument('ai', testInputs());

        expect(headings(doc)).toEqual(['시그렌즈 AI', '벤치마크', '시그렌즈']);
    });

    it('메인 호스트의 llms.txt를 가리킨다', () => {
        const doc = buildLlmsDocument('ai', testInputs());

        expect(urls(doc)).toContain(`${SITE_URL}/llms.txt`);
    });

    it('사전 등록 링크는 릴리스 데이터의 gist, ZIP은 ai 호스트 + 릴리스 경로다', () => {
        const doc = buildLlmsDocument('ai', testInputs());

        expect(RELEASE).not.toBeNull();
        expect(urls(doc)).toEqual(
            expect.arrayContaining([
                RELEASE?.prereg.gistUrl,
                `${AI_SITE_URL}${RELEASE?.downloads.zipPath}`,
            ])
        );
    });

    it('벤치마크가 없으면 벤치마크 섹션 전체를 뺀다', () => {
        const doc = buildLlmsDocument('ai', testInputs({ benchmark: null }));

        expect(headings(doc)).toEqual(['시그렌즈 AI', '시그렌즈']);
    });

    it('본문 전체가 계약과 같다 (문구 변경은 의도해서만)', () => {
        const text = renderLlmsTxt(buildLlmsDocument('ai', testInputs()));

        expect(text).toBe(AI_BODY);
    });
});

describe('buildLlmsDocument 공통', () => {
    it.each(['main', 'ai'] as const)(
        '%s 파일의 어떤 주소에도 로케일 접두사가 없다',
        host => {
            const all = urls(
                buildLlmsDocument(host, testInputs({ publicApiEnabled: true }))
            );

            expect(all.filter(u => /\/(en|ja|zh|ko)\//.test(u))).toEqual([]);
        }
    );
});

describe('llmsTargetUrl', () => {
    const inputs = testInputs();

    it.each([
        [{ kind: 'mainPage', path: '/' }, `${SITE_URL}/`],
        [{ kind: 'aiPage', path: '/' }, `${AI_SITE_URL}/`],
        [
            { kind: 'mainPageFragment', path: '/methodology', fragment: 'x' },
            `${SITE_URL}/methodology#x`,
        ],
        [{ kind: 'symbolPage', symbol: 'NVDA' }, `${SITE_URL}/NVDA`],
        [
            { kind: 'rewrite', host: 'ai', path: '/llms.txt' },
            `${AI_SITE_URL}/llms.txt`,
        ],
        [
            { kind: 'publicFile', host: 'main', path: '/a.json' },
            `${SITE_URL}/a.json`,
        ],
        [
            { kind: 'repoFile', repoPath: `backtest-results/${TEST_RUN_ID}/x` },
            `https://raw.githubusercontent.com/y0ngha/siglens/master/backtest-results/${TEST_RUN_ID}/x`,
        ],
        [
            { kind: 'external', url: 'https://example.com/x' },
            'https://example.com/x',
        ],
    ] as const)('%j → %s', (target, expected) => {
        expect(llmsTargetUrl(target, inputs)).toBe(expected);
    });
});
