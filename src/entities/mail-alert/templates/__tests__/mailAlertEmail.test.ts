import { createTranslator } from 'next-intl';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { MAIL_ALERT_SIGNAL_TYPES } from '../../lib/mailAlertConstants';
import { MAIL_ALERT_UTM_CAMPAIGN } from '../../lib/mailAlertLinks';
import type {
    MailAlertHubSection,
    MailAlertPlan,
} from '../../lib/planMailAlertItems';
import type { MailAlertSignalItem } from '../../model';
import {
    buildMailAlertEmail,
    MAIL_ALERT_EMAIL_MAX_HTML_BYTES,
} from '../mailAlertEmail';
import type {
    BuildMailAlertEmailInput,
    MailAlertEmailTranslator,
} from '../mailAlertEmailTypes';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';

const tKo = catalogTranslator('entities.mail-alert.email', 'ko');
const tEn = catalogTranslator('entities.mail-alert.email', 'en');
const labelKo = catalogTranslator('shared.enumLabel', 'ko');
const labelEn = catalogTranslator('shared.enumLabel', 'en');

/**
 * 실제 next-intl 번역자. 카탈로그 스텁(`catalogTranslator`)은 ICU 복수형을 렌더하지 않으므로, 제목의 건수처럼
 * 복수형이 걸린 문장은 이 번역자로 확인한다.
 */
function icuTranslator(locale: Locale): MailAlertEmailTranslator {
    return createTranslator({
        locale,
        messages: MESSAGE_CATALOGS[locale],
        namespace: 'entities.mail-alert.email',
    } as never) as unknown as MailAlertEmailTranslator;
}

const SITE = 'https://siglens.io';
const ID = '3f0c8e3e-6b9a-4e4d-9d3a-1a2b3c4d5e6f';

function signalItem(
    overrides: Partial<MailAlertSignalItem> = {}
): MailAlertSignalItem {
    return {
        kind: 'signal',
        section: 'mine',
        market: 'us',
        symbol: 'AAPL',
        name: null,
        signalType: 'golden_cross',
        sessionDate: '2026-11-24',
        changePercent: 1.234,
        ...overrides,
    };
}

function plan(
    sections: Partial<MailAlertPlan['sections']> = {},
    itemKeys: readonly string[] = ['k1']
): MailAlertPlan {
    return {
        sections: { fearGreed: [], mine: [], hubs: [], ...sections },
        itemKeys,
        overflowKeys: [],
        suppressedCount: 0,
    };
}

function input(
    overrides: Partial<BuildMailAlertEmailInput> = {}
): BuildMailAlertEmailInput {
    return {
        to: 'user@example.com',
        locale: 'ko',
        alertDate: '2026-11-25',
        plan: plan({ mine: [signalItem()] }),
        siteUrl: SITE,
        manageUrl: `${SITE}/email-report/alerts?s=${ID}&sig=manage`,
        unsubscribePageUrl: `${SITE}/email-report/alerts?s=${ID}&sig=manage#unsubscribe`,
        unsubscribeApiUrl: `${SITE}/api/mail-alert/unsubscribe?s=${ID}&sig=unsub`,
        disclaimer: '투자 참고용이에요.',
        idempotencyKey: `mail-alert/${ID}/2026-11-25`,
        t: tKo,
        signalLabel: type =>
            labelKo.has(`signalType.${type}`)
                ? labelKo(`signalType.${type}`)
                : null,
        symbolNames: new Map(),
        ...overrides,
    };
}

function hub(
    signalType: MailAlertHubSection['signalType'],
    items: MailAlertSignalItem[],
    moreCount = 0
): MailAlertHubSection {
    return { signalType, items, moreCount };
}

describe('buildMailAlertEmail', () => {
    it('제목은 브랜드·날짜·실린 항목 수를 담는다', () => {
        const message = buildMailAlertEmail(
            input({ plan: plan({ mine: [signalItem()] }, ['a', 'b', 'c']) })
        );

        expect(message.subject).toBe('[시그렌즈] 11월 25일 새로 잡힌 변화 3건');
        expect(message.to).toBe('user@example.com');
    });

    it('영어 제목은 건수에 맞는 단수·복수형을 쓴다', () => {
        const subjectFor = (count: number) =>
            buildMailAlertEmail(
                input({
                    locale: 'en',
                    t: icuTranslator('en'),
                    plan: plan(
                        { mine: [signalItem()] },
                        Array.from({ length: count }, (_, i) => `k${i}`)
                    ),
                })
            ).subject;

        expect(subjectFor(1)).toBe('[SIGLENS] November 25: 1 new change');
        expect(subjectFor(3)).toBe('[SIGLENS] November 25: 3 new changes');
    });

    it.each(LOCALES)(
        '%s: 실제 번역자로 렌더한 제목에 건수가 들어가고 자리표시자가 남지 않는다',
        locale => {
            const message = buildMailAlertEmail(
                input({
                    locale,
                    t: icuTranslator(locale),
                    plan: plan({ mine: [signalItem()] }, ['a', 'b']),
                })
            );

            expect(message.subject).toContain('2');
            expect(message.subject).not.toMatch(/[{}#]/);
        }
    );

    it('섹션 순서는 공포 탐욕, 담은 종목, 신호별 새 종목이다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    fearGreed: [
                        {
                            kind: 'fear_greed',
                            market: 'us',
                            zone: 'EXTREME_FEAR',
                            date: '2026-11-24',
                            score: 21.4,
                        },
                    ],
                    mine: [signalItem()],
                    hubs: [
                        hub('death_cross', [
                            signalItem({
                                section: 'hub',
                                symbol: 'MSFT',
                                signalType: 'death_cross',
                            }),
                        ]),
                    ],
                }),
            })
        );

        const positions = [
            message.text.indexOf(tKo('sectionFearGreed')),
            message.text.indexOf(tKo('sectionMine')),
            message.text.indexOf('MSFT'),
        ];
        expect(positions.every(position => position >= 0)).toBe(true);
        expect(positions).toEqual(positions.toSorted((a, b) => a - b));
        expect(message.html.indexOf('sectionFearGreed')).toBe(-1);
    });

    it('신호 줄은 종목 링크·신호 이름·시장과 세션 날짜·등락을 싣는다', () => {
        const message = buildMailAlertEmail(input());

        expect(message.html).toContain(
            `href="${SITE}/AAPL?utm_source=email&amp;utm_medium=email&amp;utm_campaign=${MAIL_ALERT_UTM_CAMPAIGN}"`
        );
        expect(message.text).toContain(labelKo('signalType.golden_cross'));
        expect(message.text).toContain('미국장 11월 24일 마감 기준');
        expect(message.text).toContain('등락 +1.23%');
    });

    it('종목 이름은 메일 리포트와 같은 규칙이다: ko는 한글명, 다른 로케일은 영문 법인명', () => {
        const names = new Map([
            [
                '005930.KS',
                { name: 'Samsung Electronics', koreanName: '삼성전자' },
            ],
        ]);
        const build = (locale: Locale) =>
            buildMailAlertEmail(
                input({
                    locale,
                    t: catalogTranslator('entities.mail-alert.email', locale),
                    symbolNames: names,
                    plan: plan({
                        mine: [
                            signalItem({ market: 'kr', symbol: '005930.KS' }),
                        ],
                    }),
                })
            ).text;

        expect(build('ko')).toContain('삼성전자 (005930)');
        expect(build('en')).toContain('Samsung Electronics (005930)');
        expect(build('en')).not.toContain('삼성전자');
    });

    it('이름 조회가 없으면 ko는 신호 기록의 한글명으로, 한국 종목은 한국장 문구를 쓴다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    mine: [
                        signalItem({
                            market: 'kr',
                            symbol: '005930.KS',
                            name: '삼성전자',
                        }),
                    ],
                }),
            })
        );

        // 보이는 코드는 접미사를 뗀 표기, 링크는 원문 심볼이다.
        expect(message.text).toContain('삼성전자 (005930)');
        expect(message.text).not.toContain('(005930.KS)');
        expect(message.html).toContain(`href="${SITE}/005930.KS?`);
        expect(message.text).toContain('한국장 11월 24일 마감 기준');
    });

    it('다른 언어에서는 한국어 종목명을 쓰지 않고 코드만 쓴다', () => {
        const message = buildMailAlertEmail(
            input({
                locale: 'en',
                t: tEn,
                plan: plan({
                    mine: [
                        signalItem({ symbol: '005930.KS', name: '삼성전자' }),
                    ],
                }),
            })
        );

        expect(message.text).not.toContain('삼성전자');
        expect(message.text).toMatch(/^- 005930$/m);
    });

    it('등락률이 없으면 등락 문구를 빼고, 라벨 사전에 없는 유형은 유형 이름으로 싣는다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({ mine: [signalItem({ changePercent: null })] }),
                signalLabel: () => null,
            })
        );

        expect(message.text).not.toContain('등락');
        expect(message.text).toContain('golden_cross');
    });

    it('공포 탐욕 줄은 시장·구간·날짜·점수와 허브 링크를 싣는다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    fearGreed: [
                        {
                            kind: 'fear_greed',
                            market: 'kr',
                            zone: 'EXTREME_GREED',
                            date: '2026-11-25',
                            score: 80,
                        },
                    ],
                }),
            })
        );

        expect(message.text).toContain(
            `한국 공포 탐욕 지수가 극단적 탐욕에 들어섰어요. 11월 25일 마감 기준 80점이에요.`
        );
        expect(message.html).toContain(
            `${SITE}/fear-greed/kr?utm_source=email`
        );
    });

    it('경계 바로 옆의 반올림된 점수도 경계 문구와 어긋나지 않는다: 줄에 경계를 붙이지 않는다', () => {
        const rows = [
            ['EXTREME_FEAR', 25, '25점이에요'],
            ['EXTREME_GREED', 75, '75점이에요'],
        ] as const;

        rows.forEach(([zone, score, expected]) => {
            const message = buildMailAlertEmail(
                input({
                    plan: plan({
                        fearGreed: [
                            {
                                kind: 'fear_greed',
                                market: 'us',
                                zone,
                                date: '2026-11-24',
                                score,
                            },
                        ],
                    }),
                })
            );

            expect(message.text).toContain(expected);
            expect(message.text).not.toContain('점 미만');
            expect(message.text).not.toContain('점 이상');
            expect(message.html).not.toContain('점 미만');
            expect(message.html).not.toContain('점 이상');
        });
    });

    it('극단적 공포 줄은 구간 이름을 싣는다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    fearGreed: [
                        {
                            kind: 'fear_greed',
                            market: 'crypto',
                            zone: 'EXTREME_FEAR',
                            date: '2026-11-24',
                            score: 12.4,
                        },
                    ],
                }),
            })
        );

        expect(message.text).toContain(
            '크립토 공포 탐욕 지수가 극단적 공포에 들어섰어요. 11월 24일 마감 기준 12점이에요.'
        );
    });

    it('신호별 섹션 제목은 허브 페이지로 링크하고, 못 실은 종목 수를 알린다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    hubs: [
                        hub(
                            'golden_cross',
                            [signalItem({ section: 'hub', symbol: 'NVDA' })],
                            7
                        ),
                    ],
                }),
            })
        );

        expect(message.html).toContain(
            `href="${SITE}/market/signals/golden-cross?utm_source=email`
        );
        expect(message.text).toContain('외 7종목');
    });

    it('못 실은 종목이 없으면 "외 N종목" 줄이 없다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    hubs: [
                        hub('golden_cross', [signalItem({ section: 'hub' })]),
                    ],
                }),
            })
        );

        expect(message.text).not.toContain('외 ');
    });

    it('외부에서 온 값(종목명, 코드)은 HTML에서 이스케이프된다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    mine: [
                        signalItem({
                            market: 'kr',
                            symbol: 'X<b>"&',
                            name: '<script>alert(1)</script>',
                        }),
                    ],
                }),
            })
        );

        expect(message.html).not.toContain('<script>');
        expect(message.html).not.toContain('<b>');
        expect(message.html).toContain('&lt;script&gt;');
    });

    it('푸터: 이유, 면책 고지, 설정과 수신거부 링크, 원클릭 헤더, 멱등 키', () => {
        const message = buildMailAlertEmail(input());

        expect(message.html).toContain('투자 참고용이에요.');
        expect(message.html).toContain(
            '시그렌즈 알림 메일을 신청하셔서 보내 드리는 메일이에요. 새로 잡힌 소식이 있는 날에만 보내요.'
        );
        expect(message.html).toContain(
            `href="${escapeHtml(input().manageUrl)}"`
        );
        expect(message.html).toContain(
            `href="${escapeHtml(input().unsubscribePageUrl)}"`
        );
        expect(message.text).toContain(`알림 메일 설정: ${input().manageUrl}`);
        expect(message.text).toContain(
            `수신 거부: ${input().unsubscribePageUrl}`
        );
        expect(message.headers).toEqual({
            'List-Unsubscribe': `<${input().unsubscribeApiUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        });
        expect(message.idempotencyKey).toBe(`mail-alert/${ID}/2026-11-25`);
    });

    it('계정 관리 링크(설정·수신거부)에는 UTM을 붙이지 않는다', () => {
        const message = buildMailAlertEmail(input());

        expect(input().manageUrl).not.toContain('utm_');
        expect(message.html).not.toContain(`${input().manageUrl}&amp;utm_`);
    });

    it('홍보 문구가 없다: 광고 표기도 가입·기능 권유도 매수·매도 표현도 없다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    fearGreed: [
                        {
                            kind: 'fear_greed',
                            market: 'us',
                            zone: 'EXTREME_FEAR',
                            date: '2026-11-24',
                            score: 20,
                        },
                    ],
                    mine: [signalItem()],
                    hubs: [
                        hub(
                            'golden_cross',
                            [signalItem({ section: 'hub' })],
                            2
                        ),
                    ],
                }),
            })
        );

        const body = `${message.subject}\n${message.text}`;
        ['(광고)', '회원가입', '가입', '추천', '기회', '매수', '매도'].forEach(
            word => expect(body).not.toContain(word)
        );
        expect(message.html).not.toContain('/signup');
    });

    it('영어 로케일은 영어 본문과 html lang을 쓴다', () => {
        const message = buildMailAlertEmail(
            input({
                locale: 'en',
                t: icuTranslator('en'),
                signalLabel: type =>
                    labelEn.has(`signalType.${type}`)
                        ? labelEn(`signalType.${type}`)
                        : null,
                plan: plan({ mine: [signalItem()] }),
            })
        );

        expect(message.subject).toBe('[SIGLENS] November 25: 1 new change');
        expect(message.html).toContain('<html lang="en">');
        expect(message.text).toContain(
            'US market, as of the November 24 close'
        );
        expect(message.html).toContain(`${SITE}/en/AAPL?utm_source=email`);
    });

    it('최대 규모(담은 종목 20줄 + 신호별 8개 섹션 10줄)도 HTML 크기 상한 안이다', () => {
        const rows = (prefix: string, section: 'mine' | 'hub') =>
            Array.from({ length: section === 'mine' ? 20 : 10 }, (_, i) =>
                signalItem({
                    section,
                    market: 'kr',
                    symbol: `${prefix}${String(i).padStart(4, '0')}.KS`,
                    name: '아주 긴 한국어 종목 이름 주식회사',
                })
            );
        const message = buildMailAlertEmail(
            input({
                plan: plan({
                    mine: rows('M', 'mine'),
                    hubs: MAIL_ALERT_SIGNAL_TYPES.map(type =>
                        hub(
                            type,
                            rows(type.slice(0, 2), 'hub').map(item => ({
                                ...item,
                                signalType: type,
                            })),
                            5
                        )
                    ),
                }),
            })
        );

        expect(Buffer.byteLength(message.html)).toBeLessThan(
            MAIL_ALERT_EMAIL_MAX_HTML_BYTES
        );
    });
});

describe('알림 신호 유형의 라벨 카탈로그', () => {
    it.each(LOCALES)(
        '%s: 알림을 보내는 모든 신호 유형에 라벨이 있다',
        locale => {
            const label = catalogTranslator('shared.enumLabel', locale);

            MAIL_ALERT_SIGNAL_TYPES.forEach(type =>
                expect(label.has(`signalType.${type}`)).toBe(true)
            );
        }
    );
});
