import { SITE_NAME, type FaqItem } from '@/shared/lib/seo';

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
type JsonLdTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

/**
 * 홈에 싣는 문항. 탭별 FAQ와 중복되거나 매매 조언 톤인 문항은 뺐고, 남긴 6개는
 * 서비스 소개·시장 신호·종합 분석·백테스팅·요금·암호화폐다. 카탈로그 키는
 * 그대로 유지한다 — 번호를 다시 매기면 네 로케일의 번역이 통째로 어긋난다.
 */
const HOME_FAQ_KEYS = ['q0', 'q2', 'q8', 'q9', 'q10', 'q11'] as const;

export function buildHomeFaq(t: JsonLdTranslator): FaqItem[] {
    return HOME_FAQ_KEYS.map(key => ({
        question: t(`faq.${key}.question`, { v0: SITE_NAME }),
        answer: t(`faq.${key}.answer`, { v0: SITE_NAME }),
    }));
}
