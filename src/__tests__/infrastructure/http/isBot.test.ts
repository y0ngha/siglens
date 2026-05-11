import { isBot } from '@/infrastructure/http/isBot';

describe('isBot', () => {
    it('Googlebot User-Agent를 봇으로 판정한다', () => {
        const headers = new Headers({
            'user-agent':
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        });
        expect(isBot(headers)).toBe(true);
    });

    it('bingbot User-Agent를 봇으로 판정한다', () => {
        const headers = new Headers({
            'user-agent':
                'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        });
        expect(isBot(headers)).toBe(true);
    });

    it('일반 Chrome User-Agent는 봇이 아니다', () => {
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
