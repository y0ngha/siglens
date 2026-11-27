import { createTranslator } from 'next-intl';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { MAIL_ALERT_SIGNAL_TYPES } from '../../lib/mailAlertConstants';
import { MAIL_ALERT_UTM_CAMPAIGN } from '../../lib/mailAlertLinks';
import type {
    MailAlertHubSection,
    MailAlertPlan,
} from '../../lib/planMailAlertItems';
import type {
    MailAlertChange,
    MailAlertChangeItem,
    MailAlertMineItem,
    MailAlertPriceAlertItem,
    MailAlertSignalItem,
} from '../../model';
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

function priceAlertItem(
    overrides: Partial<MailAlertPriceAlertItem> = {}
): MailAlertPriceAlertItem {
    return {
        kind: 'price_alert',
        alertId: 'alert-1',
        symbol: 'AAPL',
        market: 'us',
        condition: { kind: 'close_below', level: 180 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190.5,
        createdAt: new Date('2026-11-20T03:00:00Z'),
        firedSession: '2026-11-24',
        firedClose: 179.5,
        zonePosition: null,
        ...overrides,
    };
}

function plan(
    sections: Partial<MailAlertPlan['sections']> = {},
    itemKeys: readonly string[] = ['k1']
): MailAlertPlan {
    return {
        sections: {
            priceAlerts: [],
            voidedPriceAlerts: [],
            fearGreed: [],
            mine: [],
            hubs: [],
            ...sections,
        },
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

    it('최대 규모(가격대 알림 10줄 + 담은 종목 20줄 + 신호별 8개 섹션 10줄)도 HTML 크기 상한 안이다', () => {
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
                    priceAlerts: Array.from({ length: 10 }, (_, i) =>
                        priceAlertItem({
                            alertId: `alert-${i}`,
                            symbol: `P${String(i).padStart(4, '0')}.KS`,
                            market: 'kr',
                            basis: 'analysis_entry_zone',
                            analysisAt: new Date('2026-11-19T16:30:00Z'),
                            condition: {
                                kind: 'enter_zone',
                                low: 70000,
                                high: 71500,
                                approach: 'from_above',
                            },
                            zonePosition: 'inside',
                        })
                    ),
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

describe('가격대 알림 섹션', () => {
    const zone = {
        kind: 'enter_zone',
        low: 178,
        high: 181.5,
        approach: 'from_above',
    } as const;

    function textOf(
        item: MailAlertPriceAlertItem,
        overrides: Partial<BuildMailAlertEmailInput> = {}
    ): string {
        return buildMailAlertEmail(
            input({
                plan: plan({ priceAlerts: [item] }, ['p:alert-1']),
                ...overrides,
            })
        ).text;
    }

    it('가격대 알림 섹션은 다른 어느 섹션보다 앞에 온다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan(
                    {
                        priceAlerts: [priceAlertItem()],
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
                    },
                    ['p:alert-1', 'f:us:EXTREME_FEAR', 's:us:AAPL:golden_cross']
                ),
            })
        );

        const positions = [
            message.text.indexOf(tKo('sectionPriceAlert')),
            message.text.indexOf(tKo('sectionFearGreed')),
            message.text.indexOf(tKo('sectionMine')),
        ];
        expect(positions[0]).toBeGreaterThanOrEqual(0);
        expect(positions).toEqual(positions.toSorted((a, b) => a - b));
        expect(message.subject).toBe('[시그렌즈] 11월 25일 새로 잡힌 변화 3건');
    });

    it('아래로 내려간 알림은 종가와 그 세션 날짜, 알림 가격을 말하고 종목 링크를 건다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan({ priceAlerts: [priceAlertItem()] }, ['p:alert-1']),
            })
        );

        expect(message.text).toContain(
            'AAPL의 11월 24일 종가가 알림 가격 US$180.00 이하로 내려갔어요. (종가 US$179.50)'
        );
        expect(message.html).toContain(`${SITE}/AAPL?utm_source=email`);
        expect(message.html).toContain(
            `utm_campaign=${MAIL_ALERT_UTM_CAMPAIGN}`
        );
    });

    it('위로 올라간 알림은 이상 문장이다', () => {
        const text = textOf(
            priceAlertItem({
                condition: { kind: 'close_above', level: 200 },
                firedClose: 201.25,
            })
        );

        expect(text).toContain(
            '종가가 알림 가격 US$200.00 이상으로 올라갔어요. (종가 US$201.25)'
        );
    });

    it.each([
        {
            position: 'inside',
            sentence: '알림 구간 US$178.00~US$181.50 안에 들어왔어요.',
        },
        {
            position: 'below',
            sentence: '알림 구간 US$178.00~US$181.50 아래로 내려왔어요.',
        },
        {
            position: 'above',
            sentence: '알림 구간 US$178.00~US$181.50 위로 올라왔어요.',
        },
    ] as const)(
        '구간 알림은 코어가 판정한 위치($position)에 맞는 문장을 쓴다',
        ({ position, sentence }) => {
            const text = textOf(
                priceAlertItem({ condition: zone, zonePosition: position })
            );

            expect(text).toContain(sentence);
            expect(
                [
                    '안에 들어왔어요',
                    '아래로 내려왔어요',
                    '위로 올라왔어요',
                ].filter(phrase => text.includes(phrase))
            ).toHaveLength(1);
        }
    );

    it('분석 기준 알림은 분석 날짜(한국 날짜)를 기준 줄에 적는다', () => {
        const entry = textOf(
            priceAlertItem({
                condition: zone,
                zonePosition: 'inside',
                basis: 'analysis_entry_zone',
                analysisAt: new Date('2026-11-19T16:30:00Z'),
            })
        );
        const invalidation = textOf(
            priceAlertItem({
                basis: 'analysis_invalidation',
                analysisAt: new Date('2026-11-19T16:30:00Z'),
            })
        );

        expect(entry).toContain('기준: 11월 20일 AI 분석의 진입 구간');
        expect(invalidation).toContain('기준: 11월 20일 AI 분석의 무효화 기준');
    });

    it('직접 말한 가격은 그 사실을 기준 줄에 적고, 분석 시각이 없는 분석 기준 알림은 날짜를 지어내지 않고 줄을 뺀다', () => {
        const named = textOf(priceAlertItem());
        const missing = textOf(
            priceAlertItem({ basis: 'analysis_entry_zone', analysisAt: null })
        );

        expect(named).toContain('기준: 대화에서 정한 가격');
        expect(missing).not.toContain('기준:');
    });

    it('만든 날과 그때 가격, 이번 한 번으로 끝난다는 문구를 싣는다', () => {
        const text = textOf(priceAlertItem());

        expect(text).toContain('알림을 만든 날 11월 20일, 그때 가격 US$190.50');
        expect(text).toContain('가격대 알림은 한 번 알리면 끝나요.');
    });

    it('한국 종목은 원화로 소수점 없이 쓴다', () => {
        const text = textOf(
            priceAlertItem({
                symbol: '005930.KS',
                market: 'kr',
                condition: { kind: 'close_below', level: 70000 },
                referenceClose: 72500,
                firedClose: 69800,
            })
        );

        expect(text).toContain('005930의 11월 24일 종가가');
        expect(text).not.toContain('005930.KS의');
        expect(text).toContain('알림 가격 ₩70,000 이하');
        expect(text).toContain('(종가 ₩69,800)');
        expect(text).toContain('그때 가격 ₩72,500');
    });

    it('외부에서 온 값(종목 코드)은 HTML에서 이스케이프된다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan(
                    { priceAlerts: [priceAlertItem({ symbol: 'X<b>"&' })] },
                    ['p:alert-1']
                ),
            })
        );

        expect(message.html).not.toContain('<b>');
        expect(message.html).toContain('X&lt;b&gt;');
    });

    it('영어 로케일은 영어 문장과 통화 서식을 쓴다', () => {
        const text = textOf(priceAlertItem(), {
            locale: 'en',
            t: tEn,
        });

        expect(text).toContain(
            'The November 24 close for AAPL was at or below your alert price, $180.00. (Closing price $179.50)'
        );
        expect(text).toContain('Based on: the price you named in the chat');
        expect(text).toContain(
            'Each price alert ends after it notifies you once.'
        );
    });

    it('끝낸 알림 안내 줄은 표시용 종목 코드로 말하고, 충족한 알림이 없으면 "한 번으로 끝나요" 문구를 싣지 않는다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan(
                    {
                        voidedPriceAlerts: [
                            {
                                kind: 'price_alert_voided',
                                alertId: 'v-1',
                                symbol: '005930.KS',
                            },
                        ],
                    },
                    ['v:v-1']
                ),
            })
        );

        expect(message.text).toContain(tKo('sectionPriceAlert'));
        expect(message.text).toContain(
            '005930 가격 기준이 크게 바뀌어(예: 주식 분할) 가격대 알림을 끝냈어요. 필요하면 새로 만들어 주세요.'
        );
        expect(message.text).not.toContain('005930.KS 가격 기준');
        expect(message.html).toContain(`${SITE}/005930.KS?utm_source=email`);
        expect(message.text).not.toContain(tKo('priceAlertOneShot'));
    });

    it('끝낸 알림 안내는 충족한 알림 줄 뒤에 같은 섹션으로 실리고 그때 한 번 문구는 남는다', () => {
        const message = buildMailAlertEmail(
            input({
                plan: plan(
                    {
                        priceAlerts: [priceAlertItem()],
                        voidedPriceAlerts: [
                            {
                                kind: 'price_alert_voided',
                                alertId: 'v-1',
                                symbol: 'MSFT',
                            },
                        ],
                    },
                    ['p:alert-1', 'v:v-1']
                ),
            })
        );

        const { text } = message;
        expect(text.split(`[${tKo('sectionPriceAlert')}]`)).toHaveLength(2);
        // 충족한 줄 → "한 번 알리면 끝나요"(섹션 전체 문장) → 끝낸 알림 안내 순이다.
        const oneShot = text.indexOf(tKo('priceAlertOneShot'));
        expect(text.indexOf('AAPL의')).toBeLessThan(oneShot);
        expect(oneShot).toBeGreaterThan(-1);
        expect(oneShot).toBeLessThan(text.indexOf('MSFT 가격 기준이 크게'));
    });

    it('투자 권유 표현이 없다: 만든 쪽이 정한 가격에 닿았다는 사실만 적는다', () => {
        const body = textOf(
            priceAlertItem({ condition: zone, zonePosition: 'below' })
        );

        ['(광고)', '가입', '추천', '기회', '매수', '매도', '손절'].forEach(
            word => expect(body).not.toContain(word)
        );
    });

    it('모든 로케일에 가격대 알림 문구 키가 있고 자리표시자가 같다', () => {
        const keys = [
            'sectionPriceAlert',
            'priceAlertZoneInside',
            'priceAlertZonePassedDown',
            'priceAlertZonePassedUp',
            'priceAlertCloseBelow',
            'priceAlertCloseAbove',
            'priceAlertBasisEntry',
            'priceAlertBasisInvalidation',
            'priceAlertBasisPrice',
            'priceAlertCreated',
            'priceAlertOneShot',
            'priceAlertVoided',
        ];
        const probe = { v0: '[0]', v1: '[1]', v2: '[2]', v3: '[3]', v4: '[4]' };
        const used = (t: ReturnType<typeof catalogTranslator>, key: string) =>
            Object.values(probe).filter(marker =>
                t(key, probe).includes(marker)
            );
        LOCALES.forEach(locale => {
            const t = catalogTranslator('entities.mail-alert.email', locale);
            keys.forEach(key => {
                expect(t.has(key)).toBe(true);
                expect(used(t, key)).toEqual(used(tKo, key));
            });
        });
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

describe('담은 종목에서 달라진 점 섹션', () => {
    const ANALYZED = '2026-11-20T01:00:00.000Z';

    function changeItem(
        change: MailAlertChange,
        overrides: Partial<MailAlertChangeItem> = {}
    ): MailAlertChangeItem {
        return {
            kind: 'change',
            section: 'mine',
            market: 'us',
            symbol: 'AAPL',
            name: null,
            sessionDate: '2026-11-24',
            change,
            ...overrides,
        };
    }

    const CHANGES: Record<MailAlertChange['kind'], MailAlertChange[]> = {
        trend: [
            { kind: 'trend', from: 'neutral', to: 'bullish' },
            { kind: 'trend', from: 'bullish', to: 'bearish' },
            { kind: 'trend', from: 'bearish', to: 'neutral' },
        ],
        level: [
            {
                kind: 'level',
                side: 'support',
                direction: 'down',
                price: 180,
                close: 178.5,
                analyzedAt: ANALYZED,
            },
            {
                kind: 'level',
                side: 'support',
                direction: 'up',
                price: 180,
                close: 181,
                analyzedAt: ANALYZED,
            },
            {
                kind: 'level',
                side: 'resistance',
                direction: 'up',
                price: 190,
                close: 191,
                analyzedAt: ANALYZED,
            },
            {
                kind: 'level',
                side: 'resistance',
                direction: 'down',
                price: 190,
                close: 189,
                analyzedAt: ANALYZED,
            },
        ],
        plan_zone: (['in_zone', 'above_zone', 'below_zone'] as const).map(
            position => ({
                kind: 'plan_zone',
                position,
                low: 170,
                high: 175,
                close: 172,
                analyzedAt: ANALYZED,
            })
        ),
        plan_stopped: [
            {
                kind: 'plan_stopped',
                stop: 165,
                close: 164,
                analyzedAt: ANALYZED,
            },
        ],
    };

    function bodyOf(
        items: MailAlertMineItem[],
        overrides: Partial<BuildMailAlertEmailInput> = {}
    ) {
        return buildMailAlertEmail(
            input({ plan: plan({ mine: items }), ...overrides })
        );
    }

    it('추세 줄은 그 종가 날짜와 바뀐 판정, 계산 기준을 말한다', () => {
        const message = bodyOf([
            changeItem({ kind: 'trend', from: 'neutral', to: 'bullish' }),
        ]);

        expect(message.text).toContain('[담은 종목에서 달라진 점]');
        expect(message.text).toContain(
            '11월 24일에 추세 판정이 보합에서 강세로 바뀌었어요.'
        );
        expect(message.text).toContain(
            '기준: 종가와 20일 지수이동평균의 기울기'
        );
    });

    it('도착한 판정에 맞는 조사를 쓴다(강세로, 약세로, 보합으로)', () => {
        const text = bodyOf(
            CHANGES.trend.map(change => changeItem(change))
        ).text;

        expect(text).toContain('보합에서 강세로 바뀌었어요.');
        expect(text).toContain('강세에서 약세로 바뀌었어요.');
        expect(text).toContain('약세에서 보합으로 바뀌었어요.');
    });

    it('지지선과 저항선 줄은 선 가격, 종가, 그 분석의 날짜를 말하고 이하·이상의 경계를 지킨다', () => {
        const text = bodyOf(
            CHANGES.level.map(change => changeItem(change))
        ).text;

        expect(text).toContain(
            '11월 24일에 지지선 US$180.00 이하로 내려와 마감했어요. (종가 US$178.50)'
        );
        expect(text).toContain(
            '11월 24일에 지지선 US$180.00 위로 올라와 마감했어요. (종가 US$181.00)'
        );
        expect(text).toContain(
            '11월 24일에 저항선 US$190.00 이상으로 올라와 마감했어요. (종가 US$191.00)'
        );
        expect(text).toContain(
            '11월 24일에 저항선 US$190.00 아래로 내려와 마감했어요. (종가 US$189.00)'
        );
        expect(text).toContain('기준: 11월 20일 AI 분석의 지지선');
        expect(text).toContain('기준: 11월 20일 AI 분석의 저항선');
    });

    it('진입 구간과 무효화 기준 줄은 구간 양끝 또는 기준 가격과 종가, 그 분석의 날짜를 말한다', () => {
        const text = bodyOf([
            ...CHANGES.plan_zone.map(change => changeItem(change)),
            ...CHANGES.plan_stopped.map(change => changeItem(change)),
        ]).text;

        expect(text).toContain(
            '11월 24일에 진입 구간 US$170.00~US$175.00 안에서 마감했어요. (종가 US$172.00)'
        );
        expect(text).toContain('US$175.00 위에서 마감했어요.');
        expect(text).toContain('US$175.00 아래에서 마감했어요.');
        expect(text).toContain(
            '11월 24일에 무효화 기준 US$165.00 이하에서 마감했어요. (종가 US$164.00)'
        );
        expect(text).toContain('기준: 11월 20일 AI 분석의 진입 구간');
        expect(text).toContain('기준: 11월 20일 AI 분석의 무효화 기준');
    });

    it('분석 날짜는 한국 날짜다(UTC로는 전날 저녁인 시각)', () => {
        const text = bodyOf([
            changeItem({
                kind: 'plan_stopped',
                stop: 165,
                close: 164,
                analyzedAt: '2026-11-19T16:30:00.000Z',
            }),
        ]).text;

        expect(text).toContain('기준: 11월 20일 AI 분석의 무효화 기준');
    });

    it('한국 종목의 가격은 원화로 소수점 없이 쓴다', () => {
        const text = bodyOf([
            changeItem(
                {
                    kind: 'level',
                    side: 'support',
                    direction: 'down',
                    price: 70000,
                    close: 69500,
                    analyzedAt: ANALYZED,
                },
                { market: 'kr', symbol: '005930.KS', name: '삼성전자' }
            ),
        ]).text;

        expect(text).toContain(
            '지지선 ₩70,000 이하로 내려와 마감했어요. (종가 ₩69,500)'
        );
    });

    it('한 종목의 줄은 제목 하나 아래에 모이고, 이름은 있는 줄에서 가져온다', () => {
        const message = bodyOf([
            changeItem({ kind: 'trend', from: 'neutral', to: 'bullish' }),
            signalItem({ name: '애플' }),
            changeItem(
                { kind: 'trend', from: 'neutral', to: 'bullish' },
                {
                    symbol: 'MSFT',
                }
            ),
        ]);

        expect(message.text.match(/^- 애플 \(AAPL\)$/gm)).toHaveLength(1);
        expect(message.text.match(/^- MSFT$/gm)).toHaveLength(1);
        expect(message.text.match(/\/AAPL\?utm_source/g)).toHaveLength(1);
        // 신호 줄은 지금까지의 모양 그대로다.
        expect(message.text).toContain(
            '골든크로스 | 미국장 11월 24일 마감 기준 | 등락 +1.23%'
        );
    });

    it('줄 문장은 HTML에서 이스케이프된다', () => {
        const message = bodyOf([
            changeItem(
                { kind: 'trend', from: 'neutral', to: 'bullish' },
                { name: '<img src=x>', symbol: 'AAPL' }
            ),
        ]);

        expect(message.html).not.toContain('<img src=x>');
        expect(message.html).toContain(escapeHtml('<img src=x>'));
    });

    it('영어 로케일은 영어 문장과 통화 서식을 쓴다', () => {
        const message = bodyOf(
            [
                changeItem({ kind: 'trend', from: 'neutral', to: 'bullish' }),
                changeItem({
                    kind: 'level',
                    side: 'support',
                    direction: 'down',
                    price: 180,
                    close: 178.5,
                    analyzedAt: ANALYZED,
                }),
            ],
            { locale: 'en', t: tEn }
        );

        expect(message.text).toContain(
            'On November 24, the trend reading changed from flat to bullish.'
        );
        expect(message.text).toContain(
            'On November 24, it closed at or below the support at $180.00. (Closing price $178.50)'
        );
        expect(message.text).toContain(
            'Based on: the support in the November 20 AI analysis'
        );
    });

    it('최대 규모(스무 종목의 가장 긴 줄 + 가격대 알림 10줄 + 신호별 8개 섹션)도 HTML 크기 상한 안이다', () => {
        const longest: MailAlertChange = {
            kind: 'plan_zone',
            position: 'below_zone',
            low: 1234567,
            high: 1334567,
            close: 1200000,
            analyzedAt: ANALYZED,
        };
        const message = bodyOf(
            Array.from({ length: 20 }, (_, i) =>
                changeItem(longest, {
                    market: 'kr',
                    symbol: `M${String(i).padStart(4, '0')}.KS`,
                    name: '아주 긴 한국어 종목 이름 주식회사',
                })
            )
        );

        expect(Buffer.byteLength(message.html)).toBeLessThan(
            MAIL_ALERT_EMAIL_MAX_HTML_BYTES
        );
    });

    it('투자 권유나 예측 표현이 없다: 종가가 어디에서 마감했는지만 적는다', () => {
        const items = Object.values(CHANGES)
            .flat()
            .map(change => changeItem(change));
        const text = bodyOf(items).text;

        [
            '(광고)',
            '가입',
            '추천',
            '기회',
            '매수',
            '매도',
            '손절',
            '하세요',
            '예상',
            '전망',
        ].forEach(word => expect(text).not.toContain(word));
    });
});

describe('달라진 점 문구 카탈로그', () => {
    const KEYS = [
        'sectionMine',
        'trendBullish',
        'trendBearish',
        'trendNeutral',
        'changeTrendToBullish',
        'changeTrendToBearish',
        'changeTrendToNeutral',
        'changeTrendBasis',
        'changeSupportDown',
        'changeSupportUp',
        'changeResistanceUp',
        'changeResistanceDown',
        'changePlanInZone',
        'changePlanAbove',
        'changePlanBelow',
        'changePlanStopped',
        'changeBasisSupport',
        'changeBasisResistance',
        'priceAlertBasisEntry',
        'priceAlertBasisInvalidation',
    ];
    const probe = { v0: '[0]', v1: '[1]', v2: '[2]', v3: '[3]' };
    const used = (t: ReturnType<typeof catalogTranslator>, key: string) =>
        Object.values(probe).filter(marker => t(key, probe).includes(marker));

    it.each(LOCALES)(
        '%s: 모든 키가 있고 자리표시자가 한국어와 같다',
        locale => {
            const t = catalogTranslator('entities.mail-alert.email', locale);

            KEYS.forEach(key => {
                expect(t.has(key)).toBe(true);
                expect(used(t, key)).toEqual(used(tKo, key));
            });
        }
    );

    // 메일의 추세 이름은 문장 속에서 읽히는 형태다. 영어만 공용 라벨(Bullish, Bearish, Flat)이 문장 중간에서
    // 어색해 소문자로 따로 두고, 나머지 로케일은 공용 라벨과 같은 말을 쓴다.
    it.each(LOCALES)(
        '%s: 추세 이름은 공용 추세 라벨의 문장 속 형태다',
        locale => {
            const t = catalogTranslator('entities.mail-alert.email', locale);
            const label = catalogTranslator('shared.enumLabel', locale);
            const sentenceForm = (value: string) =>
                locale === 'en' ? value.toLowerCase() : value;

            expect(t('trendBullish')).toBe(
                sentenceForm(label('trend.bullish'))
            );
            expect(t('trendBearish')).toBe(
                sentenceForm(label('trend.bearish'))
            );
            expect(t('trendNeutral')).toBe(
                sentenceForm(label('trend.neutral'))
            );
        }
    );

    it('한국어 조사: 강세와 약세는 받침이 없어 "로", 보합은 받침이 있어 "으로"를 쓴다', () => {
        const hasFinalConsonant = (word: string): boolean => {
            const code = word.charCodeAt(word.length - 1) - 0xac00;
            return code >= 0 && code % 28 !== 0;
        };

        expect(hasFinalConsonant(tKo('trendBullish'))).toBe(false);
        expect(hasFinalConsonant(tKo('trendBearish'))).toBe(false);
        expect(hasFinalConsonant(tKo('trendNeutral'))).toBe(true);
        expect(tKo('changeTrendToBullish', probe)).toContain('[2]로 ');
        expect(tKo('changeTrendToBearish', probe)).toContain('[2]로 ');
        expect(tKo('changeTrendToNeutral', probe)).toContain('[2]으로 ');
    });

    it.each(LOCALES)(
        '%s: 줄 문구에 줄표, 가운뎃점, 과장이나 권유 표현이 없다',
        locale => {
            const t = catalogTranslator('entities.mail-alert.email', locale);
            const FORBIDDEN = ['—', '–', '·', '・', '!', '！'];

            KEYS.forEach(key => {
                FORBIDDEN.forEach(mark =>
                    expect(t(key, probe)).not.toContain(mark)
                );
            });
        }
    );
});
