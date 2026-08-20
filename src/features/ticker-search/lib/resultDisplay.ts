import { krExchangeOf } from '@/entities/ticker';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import type { TickerSearchResult } from '@/shared/lib/types';

/**
 * 검색 결과 한 행의 **표시 규칙 단일 소스**.
 *
 * 데스크톱 인라인 자동완성(`TickerAutocomplete`)과 모바일 전체화면 오버레이
 * (`SearchOverlay`)가 같은 결과를 서로 다른 껍데기로 그린다. 이 규칙이 두 곳에
 * 복사되면 한쪽만 갱신되는 드리프트가 생기는데, 이 코드베이스는 이미 그 부류의
 * 사고를 겪었다 — `TickerAutocomplete`의 원래 주석이 경고한 그대로다:
 *
 * > `buildDisplayName`·`SymbolLayoutHeader`와 **같은 조건**이어야 한다 — 여기만
 * > 빠지면 yahoo가 이름을 채운 종목(`Samsung Electronics Co., Ltd.`)이 자동완성에서만
 * > 영문명을 달고 나와, 클릭해 들어간 페이지의 타이틀·헤더와 표기가 어긋난다
 * > (MISTAKES.md "서버/클라이언트 도메인 조건 불일치")
 *
 * 그래서 새 오버레이를 만들면서 복사하지 않고 여기로 **추출**했다. 표시 규칙을
 * 바꿀 일이 생기면 이 파일 하나만 고치면 양쪽이 함께 따라온다.
 */

/** 배지 색조. 자산군을 색으로도 구분해 스캔이 빨라진다. */
export type BadgeTone = 'crypto' | 'kr' | 'us';

export interface MarketBadgeSpec {
    label: string;
    tone: BadgeTone;
}

/**
 * FMP `exchange` 코드 중 **그대로 노출하면 읽기 어려운 것만** 담는다. 표에 없는 코드는
 * 아래 `?? code` 폴백이 원문을 쓴다 — 새 거래소가 생겼다고 배지가 사라지는 것보다 낫다.
 * 그래서 `NASDAQ: 'NASDAQ'` 같은 항등 매핑은 넣지 않는다(폴백과 완전히 같은 동작이다).
 */
const US_EXCHANGE_LABELS: Record<string, string> = {
    PNK: '미국 OTC',
    OTC: '미국 OTC',
};

/**
 * 검색 결과의 시장 배지 — **모든 결과에 붙는다**.
 *
 * `삼성전자`를 검색하면 `005930.KS`(KOSPI 주 상장)와 `SSNLF`(미국 장외 비후원)가
 * 함께 나온다. 이름이 같아 사용자가 둘을 구분할 방법이 없었다 — 하나는 원화로
 * 거래되는 주 상장이고 다른 하나는 거래가 희박한 OTC다.
 *
 * 처음엔 국내·OTC에만 붙였는데, 그러면 배지의 **부재**가 정보를 나르게 된다 —
 * "배지 없음 = 미국 정규 상장"을 사용자가 학습해야 하고, 배지 로직이 조용히 깨져도
 * 화면상 구분이 안 간다. 세 자산군 전부 명시한다.
 *
 * 이 배지가 행에 유일한 거래소 표시다. 원래는 아래에 정식명 한 줄
 * (`Korea Exchange (KOSPI)`, `New York Stock Exchange Arca`)을 더 깔았는데, 배지를
 * 전 자산군으로 넓히면서 같은 정보가 두 번 나오게 됐고 **서로 어긋나기까지 했다** —
 * FMP는 Arca 상장을 `exchange: 'AMEX'`로 주는데 `exchangeFullName`은 `... Arca`다.
 * 좁은 화면에서 종목명을 밀어내던 것도 그 긴 줄이라 배지만 남긴다.
 */
export function marketBadgeSpec(
    result: TickerSearchResult
): MarketBadgeSpec | null {
    if (result.marketProfile === 'crypto') {
        return { label: '코인', tone: 'crypto' };
    }
    if (isKrEquitySymbol(result.symbol)) {
        // 접미사→거래소 매핑은 `krExchangeOf` 한 곳에만 둔다. 여기서 `.KQ`를 다시
        // 판정하면 canonical 정규식(`KR_SYMBOL_RE`)보다 느슨한 두 번째 표가 생긴다.
        return { label: krExchangeOf(result.symbol).code, tone: 'kr' };
    }
    const full = (result.exchangeFullName ?? '').toLowerCase();
    if (full.includes('otc')) return { label: '미국 OTC', tone: 'us' };

    const code = (result.exchange ?? '').trim().toUpperCase();
    if (!code) return null;
    return { label: US_EXCHANGE_LABELS[code] ?? code, tone: 'us' };
}

export interface ResultDisplayNames {
    /** 화면에 크게 보이는 이름. 한글명이 있으면 그쪽. */
    primaryName: string;
    /** 보조로 덧붙이는 영문명. 붙이지 않을 때는 `null`. */
    secondaryName: string | null;
}

/**
 * 한국어 사용자가 읽는 화면이므로 한글명이 있으면 그쪽이 주 이름이다.
 * 영문명은 한글명과 다를 때만 덧붙인다 — 종목 마스터 시드는 영문명을 주지 않아
 * `name`에 한글명을 넣어 두므로, 그대로 두면 `삼성전자 (삼성전자)`가 된다.
 *
 * 국내 상장 종목은 한 걸음 더 나아가 영문 법인명을 아예 붙이지 않는다. 이 조건이
 * `buildDisplayName`·`SymbolLayoutHeader`와 어긋나면 자동완성에서만 영문명이 붙어
 * 종목 페이지 타이틀과 표기가 달라진다(파일 상단 JSDoc 참고).
 */
export function resultDisplayNames(
    result: TickerSearchResult
): ResultDisplayNames {
    const primaryName = result.koreanName ?? result.name;
    const secondaryName =
        result.koreanName &&
        result.name !== result.koreanName &&
        !isKrEquitySymbol(result.symbol)
            ? result.name
            : null;
    return { primaryName, secondaryName };
}
