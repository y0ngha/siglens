import { createCacheProvider } from '@/infrastructure/cache/redis';
import { Redis } from '@upstash/redis';

jest.mock('@upstash/redis');

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();

describe('createCacheProvider 함수는', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        MockRedis.mockImplementation(
            () =>
                ({
                    get: mockGet,
                    set: mockSet,
                    del: mockDel,
                }) as unknown as Redis
        );
    });

    // describe('development 환경일 때', () => {
    //     it('환경변수가 모두 있어도 null을 반환한다', () => {
    //         const originalEnv = process.env.NODE_ENV;
    //         Object.defineProperty(process.env, 'NODE_ENV', {
    //             value: 'development',
    //             configurable: true,
    //         });
    //         process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    //         process.env.UPSTASH_REDIS_REST_TOKEN = 'master-token';
    //
    //         const provider = createCacheProvider();
    //         expect(provider).toBeNull();
    //
    //         Object.defineProperty(process.env, 'NODE_ENV', {
    //             value: originalEnv,
    //             configurable: true,
    //         });
    //         delete process.env.UPSTASH_REDIS_REST_URL;
    //         delete process.env.UPSTASH_REDIS_REST_TOKEN;
    //     });
    // });

    describe('환경변수가 없을 때', () => {
        it('URL과 토큰이 모두 없으면 null을 반환한다', () => {
            delete process.env.UPSTASH_REDIS_REST_URL;
            delete process.env.UPSTASH_REDIS_REST_TOKEN;

            const provider = createCacheProvider();
            expect(provider).toBeNull();
        });

        it('URL만 있고 토큰이 없으면 null을 반환한다', () => {
            process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
            delete process.env.UPSTASH_REDIS_REST_TOKEN;

            const provider = createCacheProvider();
            expect(provider).toBeNull();

            delete process.env.UPSTASH_REDIS_REST_URL;
        });

        it('토큰만 있고 URL이 없으면 null을 반환한다', () => {
            delete process.env.UPSTASH_REDIS_REST_URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = 'master-token';

            const provider = createCacheProvider();
            expect(provider).toBeNull();

            delete process.env.UPSTASH_REDIS_REST_TOKEN;
        });
    });

    describe('URL과 master 토큰이 있을 때', () => {
        beforeEach(() => {
            process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
            process.env.UPSTASH_REDIS_REST_TOKEN = 'master-token';
        });

        afterEach(() => {
            delete process.env.UPSTASH_REDIS_REST_URL;
            delete process.env.UPSTASH_REDIS_REST_TOKEN;
            delete process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
        });

        it('CacheProvider 인터페이스를 반환한다', () => {
            const provider = createCacheProvider();
            expect(provider).not.toBeNull();
            expect(typeof provider?.get).toBe('function');
            expect(typeof provider?.set).toBe('function');
            expect(typeof provider?.delete).toBe('function');
        });

        describe('readonly 토큰이 없을 때', () => {
            it('Redis 인스턴스를 한 번만 생성하고 읽기와 쓰기에 모두 재사용한다', () => {
                createCacheProvider();

                expect(MockRedis).toHaveBeenCalledTimes(1);
                // writer(=reader): master 토큰으로 한 번만 생성
                expect(MockRedis).toHaveBeenNthCalledWith(1, {
                    url: 'https://test.upstash.io',
                    token: 'master-token',
                });
            });
        });

        describe('readonly 토큰이 있을 때', () => {
            it('writer는 master 토큰, reader는 readonly 토큰으로 Redis 인스턴스를 별도 생성한다', () => {
                process.env.UPSTASH_REDIS_REST_READONLY_TOKEN =
                    'readonly-token';

                createCacheProvider();

                expect(MockRedis).toHaveBeenCalledTimes(2);
                // writer: master 토큰 사용 (먼저 생성)
                expect(MockRedis).toHaveBeenNthCalledWith(1, {
                    url: 'https://test.upstash.io',
                    token: 'master-token',
                });
                // reader: readonly 토큰 사용
                expect(MockRedis).toHaveBeenNthCalledWith(2, {
                    url: 'https://test.upstash.io',
                    token: 'readonly-token',
                });
            });

            it('get은 reader(readonly) 인스턴스를, set/delete는 writer(master) 인스턴스를 사용한다', async () => {
                process.env.UPSTASH_REDIS_REST_READONLY_TOKEN =
                    'readonly-token';

                const mockReaderGet = jest
                    .fn()
                    .mockResolvedValueOnce({ data: 1 });
                const mockWriterSet = jest.fn().mockResolvedValueOnce('OK');
                const mockWriterDel = jest.fn().mockResolvedValueOnce(1);

                MockRedis.mockImplementationOnce(
                    () =>
                        ({
                            set: mockWriterSet,
                            del: mockWriterDel,
                        }) as unknown as Redis
                ).mockImplementationOnce(
                    () => ({ get: mockReaderGet }) as unknown as Redis
                );

                const provider = createCacheProvider()!;

                await provider.get('key');
                expect(mockReaderGet).toHaveBeenCalledWith('key');

                await provider.set('key', {}, 300);
                expect(mockWriterSet).toHaveBeenCalledWith(
                    'key',
                    {},
                    {
                        ex: 300,
                    }
                );

                await provider.delete('key');
                expect(mockWriterDel).toHaveBeenCalledWith('key');
            });
        });

        describe('get 메서드는', () => {
            it('reader 클라이언트의 get을 호출하고 결과를 반환한다', async () => {
                const cached = { summary: '테스트' };
                mockGet.mockResolvedValueOnce(cached);

                const provider = createCacheProvider();
                const result = await provider!.get('test-key');

                expect(mockGet).toHaveBeenCalledWith('test-key');
                expect(result).toBe(cached);
            });

            it('캐시 미스 시 null을 반환한다', async () => {
                mockGet.mockResolvedValueOnce(null);

                const provider = createCacheProvider();
                const result = await provider!.get('missing-key');

                expect(result).toBeNull();
            });
        });

        describe('set 메서드는', () => {
            it('writer 클라이언트의 set을 TTL과 함께 호출한다', async () => {
                mockSet.mockResolvedValueOnce('OK');

                const provider = createCacheProvider();
                await provider!.set('test-key', { value: 42 }, 300);

                expect(mockSet).toHaveBeenCalledWith(
                    'test-key',
                    { value: 42 },
                    { ex: 300 }
                );
            });
        });

        describe('delete 메서드는', () => {
            it('writer 클라이언트의 del을 호출한다', async () => {
                mockDel.mockResolvedValueOnce(1);

                const provider = createCacheProvider();
                await provider!.delete('test-key');

                expect(mockDel).toHaveBeenCalledWith('test-key');
            });
        });
    });
});
