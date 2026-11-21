import {
    EMAIL_SEND_MIN_INTERVAL_MS,
    ThrottledEmailDispatcher,
} from '../ThrottledEmailDispatcher';
import type { EmailDispatcher, EmailMessage } from '../types';

function message(to: string): EmailMessage {
    return { to, subject: 's', html: '<p>h</p>', text: 't' };
}

interface Recorder {
    dispatcher: EmailDispatcher;
    startedAt: Map<string, number>;
}

function recorder(
    send: (message: EmailMessage) => Promise<boolean> = async () => true
): Recorder {
    const startedAt = new Map<string, number>();
    return {
        startedAt,
        dispatcher: {
            sendEmail: async m => {
                startedAt.set(m.to, Date.now());
                return send(m);
            },
        },
    };
}

describe('ThrottledEmailDispatcher', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-24T22:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('첫 발송은 기다리지 않고 바로 시작한다', async () => {
        const { dispatcher, startedAt } = recorder();
        const throttled = new ThrottledEmailDispatcher(dispatcher);
        const begin = Date.now();

        await expect(throttled.sendEmail(message('a@x.com'))).resolves.toBe(
            true
        );

        expect(startedAt.get('a@x.com')).toBe(begin);
    });

    it('동시에 들어온 발송은 도착 순서대로 최소 간격을 두고 시작한다', async () => {
        const { dispatcher, startedAt } = recorder();
        const throttled = new ThrottledEmailDispatcher(dispatcher, 500);
        const begin = Date.now();

        const results = Promise.all(
            ['a', 'b', 'c'].map(name => throttled.sendEmail(message(name)))
        );
        await vi.advanceTimersByTimeAsync(1_000);

        await expect(results).resolves.toEqual([true, true, true]);
        expect(startedAt.get('a')).toBe(begin);
        expect(startedAt.get('b')).toBe(begin + 500);
        expect(startedAt.get('c')).toBe(begin + 1_000);
    });

    it('간격은 시작 시각만 잰다: 느린 발송이 다음 시작을 밀지 않는다', async () => {
        const slow = new Promise<boolean>(resolve =>
            setTimeout(() => resolve(true), 5_000)
        );
        const { dispatcher, startedAt } = recorder(m =>
            m.to === 'a' ? slow : Promise.resolve(true)
        );
        const throttled = new ThrottledEmailDispatcher(dispatcher, 500);
        const begin = Date.now();

        const results = Promise.all([
            throttled.sendEmail(message('a')),
            throttled.sendEmail(message('b')),
        ]);
        await vi.advanceTimersByTimeAsync(5_000);
        await results;

        expect(startedAt.get('b')).toBe(begin + 500);
    });

    it('간격이 지난 뒤 들어온 발송은 기다리지 않는다', async () => {
        const { dispatcher, startedAt } = recorder();
        const throttled = new ThrottledEmailDispatcher(dispatcher, 500);

        await throttled.sendEmail(message('a'));
        await vi.advanceTimersByTimeAsync(2_000);
        const later = Date.now();
        await throttled.sendEmail(message('b'));

        expect(startedAt.get('b')).toBe(later);
    });

    it('안쪽 dispatcher가 던지면 false로 바꿔 돌려주고 다음 발송은 계속된다', async () => {
        const { dispatcher } = recorder(async m => {
            if (m.to === 'boom') throw new Error('network down');
            return true;
        });
        const throttled = new ThrottledEmailDispatcher(dispatcher, 0);

        await expect(throttled.sendEmail(message('boom'))).resolves.toBe(false);
        await expect(throttled.sendEmail(message('ok'))).resolves.toBe(true);
    });

    it('안쪽 dispatcher가 false를 돌려주면 그대로 false다', async () => {
        const { dispatcher } = recorder(async () => false);
        const throttled = new ThrottledEmailDispatcher(dispatcher, 0);

        await expect(throttled.sendEmail(message('a'))).resolves.toBe(false);
    });

    it('기본 간격은 상수를 따른다', async () => {
        const { dispatcher, startedAt } = recorder();
        const throttled = new ThrottledEmailDispatcher(dispatcher);
        const begin = Date.now();

        const results = Promise.all([
            throttled.sendEmail(message('a')),
            throttled.sendEmail(message('b')),
        ]);
        await vi.advanceTimersByTimeAsync(EMAIL_SEND_MIN_INTERVAL_MS);
        await results;

        expect(startedAt.get('b')).toBe(begin + EMAIL_SEND_MIN_INTERVAL_MS);
    });
});
