import { pickAssetName } from '@/entities/ticker/lib/ticker';
import type { Locale } from '@/shared/i18n/locales';
import { displayTicker } from '@/shared/lib/displayTicker';
import type { ReportSymbolNames } from '../reportModel';

/** 메일에서 종목을 가리키는 표기. `name`이 제목, `code`는 보조 코드(접미사 없음). */
export interface ReportSymbolLabel {
    name: string;
    code: string;
    /** `이름 (코드)` — 이름과 코드가 같으면 코드 하나. 평문·alt처럼 한 줄이 필요한 곳. */
    text: string;
}

/**
 * 메일 속 종목 표기 — 사이트 종목 페이지와 같은 이름 규칙(`pickAssetName`)을 쓴다.
 * ko는 한글명, 그 밖의 로케일은 영문 법인명. 이름이 없으면(조회 실패·시세만 있는 종목)
 * 접미사를 뗀 티커 하나로 떨어진다. 벤더 심볼(`000660.KS`)은 어느 경우에도 노출하지 않는다.
 */
export function reportSymbolLabel(
    symbol: string,
    names: ReportSymbolNames | null,
    locale: Locale
): ReportSymbolLabel {
    const code = displayTicker(symbol);
    const picked =
        names === null ? '' : pickAssetName(names, symbol, locale).trim();
    const name = picked === '' || picked === symbol ? code : picked;
    return {
        name,
        code,
        text: name === code ? code : `${name} (${code})`,
    };
}
