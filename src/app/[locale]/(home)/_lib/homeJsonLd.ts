import type { Locale } from '@/shared/i18n/locales';
import { SECTOR_ETFS, SIGNAL_SECTORS } from '@/shared/config/dashboard-tickers';
import { brandName } from '@/shared/lib/brandName';
import {
    brandIntroName,
    type FaqItem,
    type SeoTranslator,
} from '@/shared/lib/seo';

/**
 * 홈에 싣는 문항. 탭별 FAQ와 중복되거나 매매 조언 톤인 문항은 뺐고, 남긴 6개는
 * 서비스 소개·시장 신호·종합 분석·백테스팅·요금·암호화폐다. 카탈로그 키는
 * 그대로 유지한다 — 번호를 다시 매기면 네 로케일의 번역이 통째로 어긋난다.
 */
const HOME_FAQ_KEYS = ['q0', 'q2', 'q8', 'q9', 'q10', 'q11'] as const;

/**
 * "어떤 서비스인가요?" — 브랜드를 소개하는 문항. 이 질문에서만 ko가 한글 표기를
 * 함께 적는다(`brandIntroName`). 화면 FAQ와 FAQPage 마크업이 같은 배열을 쓰므로
 * "시그렌즈"와 "SIGLENS"가 같은 서비스라는 문장이 두 표면에 똑같이 실린다.
 */
const BRAND_INTRO_FAQ_KEY = 'q0';

/**
 * `/market` 스캐너가 훑는 업종·테마 개수.
 *
 * 탭은 13개지만 **업종은 11개뿐**이다 — 나머지 둘(양자·우주)은 GICS 섹터가 아니라 ETF가 없는
 * 가상 테마다. 문구가 "11개 섹터"만 말하면 화면의 13개 탭과 어긋나고, "13개 섹터"라 하면
 * 테마를 섹터로 부풀린다. 둘 다 설정에서 파생해, 탭을 늘려도 FAQ가 조용히 낡지 않는다.
 */
const SCANNER_INDUSTRY_COUNT = SECTOR_ETFS.length;
const SCANNER_THEME_COUNT = SIGNAL_SECTORS.length - SECTOR_ETFS.length;

/**
 * 홈 FAQ 문항(질문·답변 문자열). 화면 `<FaqSection>`과 `FAQPage` 마크업(`buildFaqJsonLd`)이 이
 * 배열 하나를 함께 받는다 — 구글은 FAQPage의 질문·답변이 페이지에 실제로 보일 것을 요구하므로
 * 두 표면이 갈릴 수 없게 한다(홈 전용 마크업 빌더를 따로 두지 않는 이유).
 *
 * 컴포넌트 밖 모듈에 두는 이유: 사이트가 다루는 자산군을 프로즈로 선언하는 표면이라
 * `ROOT_KEYWORDS`·OG alt 등 다른 표면과 함께 바뀌어야 한다. 렌더 없이 검사할 수 있어야
 * `supportedAssets.test.ts`가 모든 표면의 동기화를 한 번에 강제한다(CONVENTIONS.md#CS-4).
 * 문구는 로케일 카탈로그(`app.home.jsonLd`)에 있다.
 */
export function buildHomeFaq(t: SeoTranslator, locale: Locale): FaqItem[] {
    return HOME_FAQ_KEYS.map(key => ({
        question: t(`faq.${key}.question`, {
            v0:
                key === BRAND_INTRO_FAQ_KEY
                    ? brandIntroName(locale)
                    : brandName(locale),
        }),
        // 값은 모든 답변에 넘긴다 — 쓰지 않는 답변은 무시한다(next-intl은 남는 값을 안 본다).
        answer: t(`faq.${key}.answer`, {
            v0: brandName(locale),
            v1: SCANNER_INDUSTRY_COUNT,
            v2: SCANNER_THEME_COUNT,
        }),
    }));
}
