import { describe, expect, it } from 'vitest';
import {
    isAllowedByRobots,
    isRobotsRuleList,
    parseRobots,
} from '@/shared/api/web/robotsTxt';

const TOKEN = 'siglensai';
const allowed = (robots: string, path: string) =>
    isAllowedByRobots(parseRobots(robots, TOKEN), path);

describe('parseRobots', () => {
    it('uses the named group over `*`', () => {
        const rules = parseRobots(
            'User-agent: *\nDisallow: /\n\nUser-agent: SiglensAI\nAllow: /\nDisallow: /private',
            TOKEN
        );
        expect(rules).toEqual([
            { allow: true, path: '/' },
            { allow: false, path: '/private' },
        ]);
    });

    it('falls back to `*` and ignores comments, CRLF and unknown fields', () => {
        const rules = parseRobots(
            'Sitemap: https://x/s.xml\r\nUser-agent: *  # all\r\nCrawl-delay: 5\r\nDisallow: /a # note\r\n',
            TOKEN
        );
        expect(rules).toEqual([{ allow: false, path: '/a' }]);
    });

    it('merges consecutive user-agent lines into one group', () => {
        const rules = parseRobots(
            'User-agent: googlebot\nUser-agent: siglensai\nDisallow: /x',
            TOKEN
        );
        expect(rules).toEqual([{ allow: false, path: '/x' }]);
    });

    it('does not match a different agent whose name merely starts the same', () => {
        expect(parseRobots('User-agent: siglens\nDisallow: /', TOKEN)).toEqual(
            []
        );
    });

    it('skips empty Disallow (allow all) and oversized patterns, and caps the rule count', () => {
        const many = Array.from({ length: 800 }, (_, i) => `Disallow: /p${i}`);
        const rules = parseRobots(
            [
                'User-agent: *',
                'Disallow:',
                `Disallow: /${'a'.repeat(600)}`,
                ...many,
            ].join('\n'),
            TOKEN
        );
        expect(rules).toHaveLength(500);
        expect(rules.every(r => r.path.length <= 512)).toBe(true);
    });
});

describe('isAllowedByRobots', () => {
    it('allows everything without rules', () => {
        expect(allowed('', '/anything')).toBe(true);
    });

    it('prefix-matches Disallow and leaves other paths open', () => {
        const robots = 'User-agent: *\nDisallow: /news/private';
        expect(allowed(robots, '/news/private/a')).toBe(false);
        expect(allowed(robots, '/news/public/a')).toBe(true);
        // Near-miss: a longer segment that only shares the first characters of the prefix.
        expect(allowed(robots, '/news/privat')).toBe(true);
    });

    it('longest pattern wins, and Allow wins a tie', () => {
        const robots =
            'User-agent: *\nDisallow: /a\nAllow: /a/open\nDisallow: /b\nAllow: /b';
        expect(allowed(robots, '/a/closed')).toBe(false);
        expect(allowed(robots, '/a/open/x')).toBe(true);
        expect(allowed(robots, '/b/x')).toBe(true);
    });

    it('supports * wildcards and a $ end anchor', () => {
        const robots =
            'User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp/*/draft';
        expect(allowed(robots, '/files/a.pdf')).toBe(false);
        expect(allowed(robots, '/files/a.pdf?x=1')).toBe(true);
        expect(allowed(robots, '/files/a.pdfx')).toBe(true);
        expect(allowed(robots, '/tmp/u1/draft/1')).toBe(false);
        expect(allowed(robots, '/tmp/u1/final')).toBe(true);
    });

    it('matches the query string as part of the path', () => {
        const robots = 'User-agent: *\nDisallow: /*?print=';
        expect(allowed(robots, '/a?print=1')).toBe(false);
        expect(allowed(robots, '/a?page=1')).toBe(true);
    });

    it('stays fast on a wildcard-heavy pattern against a long non-matching path', () => {
        const robots = `User-agent: *\nDisallow: /${'*a'.repeat(200)}b`;
        const started = performance.now();
        expect(allowed(robots, `/${'a'.repeat(5_000)}`)).toBe(true);
        expect(performance.now() - started).toBeLessThan(200);
    });
});

describe('isRobotsRuleList', () => {
    it('accepts a well-formed list and rejects other shapes', () => {
        expect(isRobotsRuleList([{ allow: true, path: '/' }])).toBe(true);
        expect(isRobotsRuleList([])).toBe(true);
        expect(isRobotsRuleList({})).toBe(false);
        expect(isRobotsRuleList([{ allow: 'yes', path: '/' }])).toBe(false);
        expect(isRobotsRuleList([null])).toBe(false);
    });
});

describe('parseRobots on hostile input (cap-sized, linear time)', () => {
    const CAP = 512_000;

    it('many user-agent lines in one group: agents are capped, work stays linear', () => {
        const lines = Array.from(
            { length: Math.floor(CAP / 14) },
            () => 'user-agent: a'
        );
        const text = `${lines.join('\n')}\nuser-agent: siglensai\nDisallow: /x\n`;
        const started = performance.now();
        const rules = parseRobots(text, 'siglensai');
        const elapsed = performance.now() - started;
        // The token sits past the per-group agent cap, so the group is not ours.
        expect(rules).toEqual([]);
        // The copy-per-line implementation needed hundreds of millions of element copies here.
        expect(elapsed).toBeLessThan(250);
    });

    it('many groups: the group count is capped and later rules are dropped', () => {
        const groups = Array.from(
            { length: Math.floor(CAP / 30) },
            (_, i) => `user-agent: bot${i}\ndisallow: /a`
        );
        const text = `${groups.join('\n')}\nuser-agent: siglensai\ndisallow: /late\n`;
        const started = performance.now();
        const rules = parseRobots(text, 'siglensai');
        expect(performance.now() - started).toBeLessThan(250);
        expect(rules).toEqual([]);
    });

    it('a group inside the caps still parses normally', () => {
        const text =
            'user-agent: other\nuser-agent: siglensai\ndisallow: /ok\n';
        expect(parseRobots(text, 'siglensai')).toEqual([
            { allow: false, path: '/ok' },
        ]);
    });
});
