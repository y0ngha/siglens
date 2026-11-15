import { describe, expect, it } from 'vitest';
import {
    isFullyCurated,
    pickXAccounts,
    xAccountCandidates,
} from '../pickXAccounts';

/** 모듈 내부 상한(역할당 후보 15개)과 위키데이터 후보의 팔로워 하한(1,000). */
const X_CANDIDATES_PER_ROLE_MAX = 15;
const X_WIKIDATA_MIN_FOLLOWERS = 1_000;

const user = (username: string, followers: number, id = '1') => ({
    id,
    username,
    name: `${username} name`,
    followers,
});

describe('xAccountCandidates', () => {
    it('큐레이션 표가 두 역할을 채우면 위키데이터 후보를 쓰지 않는다(TSLA)', () => {
        expect(isFullyCurated('TSLA')).toBe(true);
        expect(
            xAccountCandidates('TSLA', {
                companyHandles: ['TeslaSupport'],
                executives: [{ name: 'Elon Musk', handles: ['cyb3rgam3r420'] }],
            })
        ).toEqual([
            { handle: 'Tesla', role: 'company', name: null, curated: true },
            {
                handle: 'elonmusk',
                role: 'ceo',
                name: 'Elon Musk',
                curated: true,
            },
        ]);
    });

    it('회사만 큐레이션된 종목은 CEO 후보를 위키데이터에서 가져온다(META)', () => {
        expect(isFullyCurated('META')).toBe(false);
        expect(
            xAccountCandidates('META', {
                companyHandles: ['Facebook', 'Meta'],
                executives: [{ name: 'Mark Zuckerberg', handles: ['finkd'] }],
            })
        ).toEqual([
            { handle: 'Meta', role: 'company', name: null, curated: true },
            {
                handle: 'finkd',
                role: 'ceo',
                name: 'Mark Zuckerberg',
                curated: false,
            },
        ]);
    });

    it('큐레이션 표에 없으면 위키데이터 후보 전부(역할당 상한까지)', () => {
        const many = Array.from(
            { length: X_CANDIDATES_PER_ROLE_MAX + 3 },
            (_, i) => `acct${i}`
        );
        const candidates = xAccountCandidates('MSFT', {
            companyHandles: many,
            executives: [{ name: 'Satya Nadella', handles: ['satyanadella'] }],
        });
        expect(candidates.filter(c => c.role === 'company')).toHaveLength(
            X_CANDIDATES_PER_ROLE_MAX
        );
        expect(candidates.at(-1)).toEqual({
            handle: 'satyanadella',
            role: 'ceo',
            name: 'Satya Nadella',
            curated: false,
        });
    });

    it('같은 핸들(대소문자 무시)은 회사 계정으로 한 번만 싣는다', () => {
        const candidates = xAccountCandidates('ZZZZ', {
            companyHandles: ['Acme'],
            executives: [{ name: 'Jane Doe', handles: ['acme'] }],
        });
        expect(candidates).toEqual([
            { handle: 'Acme', role: 'company', name: null, curated: false },
        ]);
    });

    it('위키데이터가 실패했으면(null) 큐레이션 후보만, 큐레이션도 없으면 빈 목록', () => {
        expect(xAccountCandidates('META', null)).toEqual([
            { handle: 'Meta', role: 'company', name: null, curated: true },
        ]);
        expect(xAccountCandidates('ZZZZ', null)).toEqual([]);
    });
});

describe('pickXAccounts', () => {
    it('역할마다 팔로워가 가장 많은 계정을 고르고, 사람 이름은 출처 값을 쓴다', () => {
        const picked = pickXAccounts(
            [
                {
                    handle: 'AppleSupport',
                    role: 'company',
                    name: null,
                    curated: false,
                },
                {
                    handle: 'Apple',
                    role: 'company',
                    name: null,
                    curated: false,
                },
                {
                    handle: 'johnternus',
                    role: 'ceo',
                    name: 'John Ternus',
                    curated: false,
                },
            ],
            [
                user('AppleSupport', 1_000_000, '11'),
                user('Apple', 9_000_000, '12'),
                user('johnternus', 50_000, '13'),
            ]
        );
        expect(picked).toEqual([
            {
                userId: '12',
                handle: 'Apple',
                name: 'Apple name',
                role: 'company',
                followers: 9_000_000,
            },
            {
                userId: '13',
                handle: 'johnternus',
                name: 'John Ternus',
                role: 'ceo',
                followers: 50_000,
            },
        ]);
    });

    it('위키데이터 후보는 팔로워 하한 미만이면 버리고, 큐레이션 후보는 하한을 적용하지 않는다', () => {
        const below = X_WIKIDATA_MIN_FOLLOWERS - 1;
        expect(
            pickXAccounts(
                [
                    {
                        handle: 'fresh',
                        role: 'company',
                        name: null,
                        curated: false,
                    },
                ],
                [user('fresh', below)]
            )
        ).toEqual([]);
        expect(
            pickXAccounts(
                [
                    {
                        handle: 'fresh',
                        role: 'company',
                        name: null,
                        curated: true,
                    },
                ],
                [user('fresh', below)]
            )
        ).toHaveLength(1);
        expect(
            pickXAccounts(
                [
                    {
                        handle: 'fresh',
                        role: 'company',
                        name: null,
                        curated: false,
                    },
                ],
                [user('fresh', X_WIKIDATA_MIN_FOLLOWERS)]
            )
        ).toHaveLength(1);
    });

    it('X가 모르는 핸들은 버린다(조회 결과는 대소문자를 무시하고 맞춘다)', () => {
        expect(
            pickXAccounts(
                [
                    { handle: 'gone', role: 'ceo', name: 'A', curated: true },
                    {
                        handle: 'nvidia',
                        role: 'company',
                        name: null,
                        curated: true,
                    },
                ],
                [user('NVIDIA', 5_000)]
            )
        ).toEqual([
            {
                userId: '1',
                handle: 'NVIDIA',
                name: 'NVIDIA name',
                role: 'company',
                followers: 5_000,
            },
        ]);
    });
});
