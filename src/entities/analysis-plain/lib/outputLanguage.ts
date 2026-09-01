import type { Locale } from '@/shared/i18n/locales';

/**
 * 평이화 산출물의 출력 언어 지시.
 *
 * ## 왜 별도 블록이고, 왜 영어로 쓰는가
 *
 * `buildPlainPrompt`의 본문은 전부 한국어다. 거기에 `- 일본어로 쓰세요.` 한 줄을
 * 끼워 넣는 방식은 **작동하지 않는다.** 실측(코퍼스 3건 × 4로케일, 프로덕션
 * 프롬프트·프로바이더 그대로):
 *
 *   요청 ko → ko 4/4
 *   요청 en → en 2/3, ko 1
 *   요청 ja → **ko 3/3**
 *   요청 zh → **ko 3/3**
 *
 * 모델은 지시를 읽기 전에 프롬프트 자체의 언어를 본보기로 삼는다.
 *
 * ## 지시문은 **대상 언어로** 쓴다
 *
 * core는 출력 언어 계약을 영어로 쓴다(`domain/analysis/outputLocale.ts`) — 그쪽은
 * 프롬프트 전체가 영어라 영어 지시가 본문과 같은 편에 선다. 여기는 본문이 한국어라
 * 사정이 정반대다. 최소 대조군으로 분리해 측정했다(같은 모델·같은 어댑터):
 *
 *   A. 영어 지시만 (한국어 본문 없음)          → 중국어 ✅
 *   B. 한국어 본문 + **영어** 말미 오버라이드   → 한국어 ❌
 *   C. B + **영어** 시스템 프롬프트            → 한국어 ❌
 *   D. 한국어 본문 + **중국어** 말미 오버라이드 → 중국어 ✅
 *
 * 즉 모델이 중국어를 못 쓰는 것이 아니라, **한국어 본문이 있으면 영어 지시로는
 * 뒤집히지 않는다.** 지시를 대상 언어로 쓸 때만 이긴다. 그래서 아래 문구는
 * 로케일마다 그 언어로 적혀 있다.
 *
 * `register`(공손 층위)를 지정하는 이유는 core와 같다 — 언어마다 기본 문체가
 * 달라, 지정하지 않으면 같은 분석이 호출마다 문체를 오간다.
 */
const OUTPUT_LANGUAGE = {
    en: {
        name: 'English',
        header: '[OUTPUT LANGUAGE: English. The instructions below are written in Korean; your answer must not be.]',
        directive: [
            'OUTPUT LANGUAGE (FINAL — OVERRIDES EVERY INSTRUCTION ABOVE)',
            '- Write the entire response in English, in plain professional prose (no honorifics, no slang).',
            '- The rewriting rules above are Korean; the source text is already English. Keep it English.',
            '- The Korean example sentences above demonstrate the rewriting technique, not the output language.',
            '- Every rule above still applies: no indicator names, no invented numbers, no markdown, no greeting, paragraphs only.',
        ].join('\n'),
        system: 'Write every word of your answer in English. The rewriting rules are written in Korean; that is the language of the instructions, never of your output.',
        retry: 'Your previous answer contained Korean text. Rewrite it entirely in English.',
    },
    ja: {
        name: '日本語',
        header: '【出力言語：日本語。以下の指示は韓国語で書かれていますが、回答は日本語で書いてください。】',
        directive: [
            '出力言語（最終指示 — 上記のすべての指示に優先します）',
            '- 回答は全文を日本語で、です・ます調で書いてください。',
            '- 上の書き換え規則は韓国語ですが、原文はすでに日本語です。日本語のまま書き換えてください。',
            '- 上の例文は韓国語ですが、それは書き換えの「やり方」を示す例であって、出力言語の例ではありません。',
            '- 上のすべての規則はそのまま適用されます。指標名を書かない、数値を作らない、マークダウンや前置きを付けない、段落のみで書く。',
            '',
            'それでは、書き換えた文章を日本語で書いてください：',
        ].join('\n'),
        system: '回答は必ず全文を日本語（です・ます調）で書いてください。書き換えの規則は韓国語で書かれていますが、それは指示の言語であり、出力の言語ではありません。韓国語で書いてはいけません。',
        retry: '前回の回答に韓国語が混ざっていました。全文を日本語（です・ます調）で書き直してください。',
    },
    zh: {
        name: '简体中文',
        header: '【输出语言：简体中文。以下指示以韩语写成，但你的回答不得使用韩语。】',
        directive: [
            '输出语言（最终要求 — 覆盖以上所有指示）',
            '- 请全程使用简体中文书写，采用书面语，只使用简体字。',
            '- 上面的改写规则是韩语，但原文已经是简体中文。请继续用简体中文改写。',
            '- 上面的例句是韩语，它示范的是改写方法，不是输出语言。',
            '- 上面的所有规则依然有效：不写指标名称、不编造数字、不使用markdown、不加开场白、只用段落书写。',
            '',
            '现在请用简体中文写出改写后的内容：',
        ].join('\n'),
        system: '你必须全程使用简体中文回答。改写规则是用韩语写的，那是指示的语言，不是输出的语言。绝对不要使用韩语。',
        retry: '你上一次的回答里出现了韩语。请全程改用简体中文重写。',
    },
} as const satisfies Record<
    string,
    {
        name: string;
        header: string;
        directive: string;
        system: string;
        retry: string;
    }
>;

/** 기본 출력 언어. 이 값이면 지시가 붙지 않는다. */
export const DEFAULT_PLAIN_LOCALE = 'ko';

function isOverridden(locale: string): locale is keyof typeof OUTPUT_LANGUAGE {
    return locale in OUTPUT_LANGUAGE;
}

/**
 * 프롬프트 **맨 앞** 한 줄. 모델이 가장 강하게 읽는 자리다.
 *
 * 기본 로케일(ko)에서는 빈 문자열이다 — 한국어 본문이 이미 한국어 출력을
 * 끌어내고 있고(실측 6/6), 붙이면 튜닝을 끝낸 ko 프롬프트의 바이트가 달라져
 * 캐시가 통째로 낡는다. 알 수 없는 로케일도 같은 이유로 빈 문자열이다.
 */
export function plainOutputLanguageHeader(locale: Locale | string): string {
    return isOverridden(locale) ? `${OUTPUT_LANGUAGE[locale].header}\n\n` : '';
}

/**
 * 프롬프트 **맨 끝** 블록. 마지막 지시가 가장 세다.
 *
 * 끝에 "이제 ~로 써 주세요"라는 시작 큐를 함께 둔다 — 대조군 E·F에서 이 큐가
 * 있을 때 응답이 곧바로 대상 언어로 시작했다.
 */
export function plainOutputLanguageDirective(locale: Locale | string): string {
    return isOverridden(locale)
        ? `\n\n${OUTPUT_LANGUAGE[locale].directive}`
        : '';
}

/**
 * 시스템 프롬프트에 실을 출력 언어 계약.
 *
 * 이것만으로는 부족하다(대조군 C에서 영어 시스템 프롬프트는 한국어 출력을 못
 * 막았다). 대상 언어로 쓴 머리말·말미와 **함께** 쓸 때 의미가 있다.
 *
 * 기본 로케일(ko)에서는 `undefined`를 돌려 시스템 프롬프트 자체를 붙이지 않는다 —
 * 지금까지 튜닝하고 측정한 ko 경로의 호출 형태를 그대로 둔다.
 */
export function plainSystemInstruction(
    locale: Locale | string
): string | undefined {
    return isOverridden(locale) ? OUTPUT_LANGUAGE[locale].system : undefined;
}

/**
 * 재시도 때 붙일 언어 지적문 — **대상 언어로** 쓴다.
 *
 * 지적문을 한국어로 쓰면 그것이 또 하나의 한국어 본보기가 되어, 정정하려는
 * 실패를 오히려 강화한다. 기본 로케일에서는 `null`이고 호출자가 기존 한국어
 * 지적문을 그대로 쓴다.
 */
export function plainLanguageRetryHint(locale: Locale | string): string | null {
    return isOverridden(locale) ? OUTPUT_LANGUAGE[locale].retry : null;
}
