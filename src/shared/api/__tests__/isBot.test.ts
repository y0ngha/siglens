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
            // Next 내장 정규식이 잡지 못해 방문자 집계로 새던 토큰들.
            [
                'PerplexityBot',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
            ],
            [
                'ChatGPT-User',
                'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
            ],
            [
                'Bytespider',
                'Mozilla/5.0 (compatible; Bytespider; https://zhanzhang.toutiao.com/)',
            ],
            [
                'AhrefsBot',
                'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
            ],
            [
                'Yeti (네이버)',
                'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',
            ],
            [
                'HeadlessChrome',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36',
            ],
            ['curl', 'curl/8.7.1'],
            ['python-requests', 'python-requests/2.32.3'],
        ])('%s를 봇으로 판정한다', (_, userAgent) => {
            const headers = new Headers({
                'user-agent': userAgent,
            });
            expect(isBot(headers)).toBe(true);
        });
    });

    describe('일반 User-Agent를 받으면', () => {
        // 봇 목록을 넓히면서 실제 브라우저를 함께 잡아 버리는 것이 최악이다 —
        // 조용히 방문자 수가 줄고 분석 큐 적재까지 막힌다.
        it.each([
            [
                'macOS Chrome',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            ],
            [
                'iOS Safari',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
            ],
            [
                'Windows Edge',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
            ],
            [
                'Android Chrome',
                'Mozilla/5.0 (Linux; Android 14; SM-S926N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
            ],
            [
                'macOS Safari',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
            ],
            [
                '네이버 앱 인앱 브라우저',
                'Mozilla/5.0 (Linux; Android 14; SM-S926N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.9.4)',
            ],
            [
                '카카오톡 인앱 브라우저',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.5',
            ],
            [
                '웨일 브라우저',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Whale/4.0.0.0 Safari/537.36',
            ],
            [
                '삼성 인터넷',
                'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 SamsungBrowser/25.0',
            ],
        ])('%s는 봇이 아니다', (_, userAgent) => {
            expect(isBot(new Headers({ 'user-agent': userAgent }))).toBe(false);
        });

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
