import type { Locale } from '@/shared/i18n/locales';
import { SECTOR_ETFS, SIGNAL_SECTORS } from '@/shared/config/dashboard-tickers';
import { brandName } from '@/shared/lib/brandName';
import {
    brandIntroName,
    type FaqItem,
    type SeoTranslator,
} from '@/shared/lib/seo';

/**
 * 홈의 FAQ.
 *
 * **왜 page.tsx 밖으로 뺐는가**: 이 블록은 사이트가 어떤 자산군을 다루는지
 * 프로즈로 선언하는 표면이고, 같은 선언이 `ROOT_TITLE`·`SITE_DESCRIPTION`·
 * `ROOT_KEYWORDS`·OG alt에도 각각 흩어져 있다. 한국 상장 종목을 추가하면서 그중
 * 일부만 고치는 일이 세 라운드 연속 반복됐다(MISTAKES.md §6.6). 컴포넌트 본문
 * 안에 있으면 렌더 없이는 검사할 수 없어 테스트로 동기화를 강제할 수가 없다 —
 * 모듈로 빼서 `supportedAssets.test.ts`가 모든 표면을 한 번에 검사한다.
 *
 * **문구는 카탈로그에 있다**(`app.home.jsonLd`). 예전에는 여기에 한국어가 박혀
 * 있어서, `/en`의 `WebPage`가 `inLanguage: "en"`을 선언하면서 FAQ 전 문항을
 * 한국어로 내보냈다 — 한 문서가 두 언어를 주장하는 상태였다.
 *
 * **JSON-LD 빌더가 여기 없는 이유**: 구글은 FAQPage 마크업에 대응하는 질문·답변이
 * 페이지에 실제로 **보일 것**을 요구한다. 홈은 오랫동안 12문항을 마크업으로만
 * 내보내고 화면에는 한 줄도 없었다. 이제 이 배열 하나를 `<FaqSection>`과
 * 공용 `buildFaqJsonLd`가 함께 받아 두 표면이 갈릴 수 없다 — 홈 전용 마크업
 * 빌더를 따로 두면 그 계약이 다시 두 벌이 된다.
 */
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
