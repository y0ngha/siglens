import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEMBER_ONLY_TOOLS } from '@/app/api/ai/chat/tools/memberOnlyTools';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * 회원 데이터를 읽는 에이전트 도구(`MEMBER_ONLY_TOOLS`)가 개인정보처리방침의 AI 대화 조항과 짝인지 본다. 도구 결과는
 * 모델 컨텍스트에 실려 DeepSeek(실패하면 Google의 Gemini)로 전송되고 대화와 함께 계정에 저장된다. 그래서 방침이
 * 그 정보를 네 곳에서 말해야 한다: §2 수집 조항, §4 보유 기간 항목, §6의 DeepSeek·Google 이전 항목. 새 회원 전용 도구가
 * 생기면 이 가드가 방침 문구를 요구하고, 방침 문구가 빠지면 실패한다(보유 종목은 문장만 있었고 이 가드가 없었다).
 * **가장 높은 버전**의 원문을 읽는다.
 */
const PRIVACY_DIR = path.resolve(process.cwd(), 'db/seeds/terms/privacy');
const ORIGINAL_FILE = /^v(\d+)\.md$/;

function highestOriginalVersion(): number {
    return Math.max(
        ...readdirSync(PRIVACY_DIR).flatMap(name => {
            const match = ORIGINAL_FILE.exec(name);
            return match?.[1] === undefined ? [] : [Number(match[1])];
        })
    );
}

const VERSION = highestOriginalVersion();
const readPolicy = (locale: Locale): string =>
    readFileSync(
        path.join(
            PRIVACY_DIR,
            locale === 'ko' ? `v${VERSION}.md` : `v${VERSION}.${locale}.md`
        ),
        'utf8'
    );

/** `## from.`부터 `## to.` 앞까지. 없으면 빈 문자열. */
function sectionBetween(policy: string, from: number, to: number): string {
    const start = policy.search(new RegExp(`^## ${from}\\.`, 'm'));
    const end = policy.search(new RegExp(`^## ${to}\\.`, 'm'));
    return start === -1 || end === -1 ? '' : policy.slice(start, end);
}

const bulletsStartingWith = (section: string, opening: string): string[] =>
    section.split('\n').filter(line => line.startsWith(opening));

/** 도구 → 방침이 그 도구가 모델에 싣는 정보를 가리키는 말. 새 회원 전용 도구는 여기에 먼저 더해야 한다. */
const PHRASE_BY_TOOL: Readonly<
    Record<string, Readonly<Record<Locale, string>>>
> = {
    get_my_portfolio: {
        ko: '보유 종목 정보',
        en: 'portfolio holdings',
        ja: '保有銘柄情報',
        zh: '持仓信息',
    },
    get_my_watchlist: {
        ko: '관심종목',
        en: 'watchlist',
        ja: 'ウォッチリスト',
        zh: '自选股',
    },
};

interface LocaleMarkers {
    /** §2의 AI 대화 수집 항목이 시작하는 말(비회원 항목과 회원 항목이 같은 말로 시작한다). */
    readonly collection: string;
    /** §4의 대화 내역 보유 항목이 시작하는 말. */
    readonly retention: string;
}

const MARKERS: Record<Locale, LocaleMarkers> = {
    ko: {
        collection: '- 시그렌즈 AI(ai.siglens.io) 대화 기능을 이용하는 경우',
        retention: '- 시그렌즈 AI 대화 내역',
    },
    en: {
        collection: '- If the SIGLENS AI (ai.siglens.io) chat feature is used',
        retention: '- SIGLENS AI conversation history',
    },
    ja: {
        collection: '- SIGLENS AI(ai.siglens.io)のチャット機能を利用する場合',
        retention: '- SIGLENS AI会話履歴',
    },
    zh: {
        collection: '- 使用SIGLENS AI(ai.siglens.io)聊天功能时',
        retention: '- SIGLENS AI对话记录',
    },
};

/** 방침의 네 곳(수집, 보유, DeepSeek 이전, Google 이전)에서 AI 대화 항목을 모은다. */
function aiChatClauses(policy: string, locale: Locale) {
    const { collection, retention } = MARKERS[locale];
    const transfers = sectionBetween(policy, 6, 7).split('\n');
    const aiTransfer = (provider: string) =>
        transfers.filter(
            line =>
                line.startsWith(`- **${provider}**`) &&
                line.includes('ai.siglens.io')
        );
    return {
        collection: bulletsStartingWith(
            sectionBetween(policy, 2, 3),
            collection
        ),
        retention: bulletsStartingWith(sectionBetween(policy, 4, 5), retention),
        deepseek: aiTransfer('DeepSeek'),
        google: aiTransfer('Google LLC'),
    };
}

describe('회원 전용 에이전트 도구는 방침의 AI 대화 조항과 짝이다', () => {
    it('모든 회원 전용 도구에 방침 문구가 정해져 있다(새 도구를 더하면 여기도 고친다)', () => {
        expect([...MEMBER_ONLY_TOOLS].sort()).toEqual(
            Object.keys(PHRASE_BY_TOOL).sort()
        );
    });

    describe.each(LOCALES)('%s', locale => {
        const clauses = aiChatClauses(readPolicy(locale), locale);

        it('네 곳의 항목을 모두 찾는다(탐지기가 공회전하지 않는다)', () => {
            expect(clauses.collection.length).toBeGreaterThan(0);
            expect(clauses.retention).toHaveLength(1);
            expect(clauses.deepseek).toHaveLength(1);
            expect(clauses.google).toHaveLength(1);
        });

        it.each([...MEMBER_ONLY_TOOLS].sort())(
            '%s: 수집 조항·보유 항목·DeepSeek·Google 이전 항목이 그 정보를 말한다',
            tool => {
                const phrase = PHRASE_BY_TOOL[tool]?.[locale] ?? '';
                expect(phrase).not.toBe('');
                // 수집 조항은 비회원 항목과 회원 항목이 나란히 있다 — 회원 항목 하나가 말하면 된다.
                expect(
                    clauses.collection.some(line => line.includes(phrase))
                ).toBe(true);
                expect(clauses.retention[0]).toContain(phrase);
                expect(clauses.deepseek[0]).toContain(phrase);
                expect(clauses.google[0]).toContain(phrase);
            }
        );
    });
});

describe('탐지기 반증(공회전 방지)', () => {
    const ko = readPolicy('ko');
    const phrase = PHRASE_BY_TOOL.get_my_watchlist?.ko ?? '';

    it('보유 항목에서 관심종목 문구를 지운 사본은 통과하지 못한다', () => {
        const tampered = ko.replace(
            '조회된 시장 데이터, 보유 종목 정보, 관심종목과 가격대 알림 정보',
            '조회된 시장 데이터, 보유 종목 정보'
        );
        const { retention } = aiChatClauses(tampered, 'ko');

        expect(tampered).not.toBe(ko);
        expect(retention[0]).not.toContain(phrase);
    });

    it('Google 이전 항목에서 관심종목 문구를 지운 사본은 통과하지 못한다', () => {
        const tampered = ko.replace(
            '회원이 물어본 경우 관심종목과 걸어 둔 가격대 알림)',
            ')'
        );
        const { google } = aiChatClauses(tampered, 'ko');

        expect(tampered).not.toBe(ko);
        expect(google[0]).not.toContain(phrase);
    });
});
