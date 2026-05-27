import { isBot } from '@/shared/api/isBot';

describe('isBot 함수는', () => {
    describe('봇 User-Agent를 받으면', () => {
        it.each([
            [
                'Googlebot',
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            ],
            [
                'bingbot',
                'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
            ],
            [
                'GPTBot',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)',
            ],
            [
                'ClaudeBot',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +https://claude.com/claudebot)',
            ],
            [
                'Claude-User',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +https://claude.com/)',
            ],
            [
                'Claude-SearchBot',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://claude.com/)',
            ],
            [
                'Google-CloudVertexBot',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-CloudVertexBot; +https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)',
            ],
            [
                'Gemini-Deep-Research',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Gemini-Deep-Research; +https://gemini.google/overview/deep-research/) Chrome/135.0.0.0 Safari/537.36',
            ],
        ])('%s를 봇으로 판정한다', (_, userAgent) => {
            const headers = new Headers({
                'user-agent': userAgent,
            });
            expect(isBot(headers)).toBe(true);
        });
    });

    describe('일반 User-Agent를 받으면', () => {
        it('Chrome 브라우저는 봇이 아니다', () => {
            const headers = new Headers({
                'user-agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            });
            expect(isBot(headers)).toBe(false);
        });

        it('User-Agent 헤더가 비어있으면 봇이 아니다', () => {
            const headers = new Headers();
            expect(isBot(headers)).toBe(false);
        });
    });
});
