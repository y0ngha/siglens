import 'server-only';
import { promisify } from 'node:util';
import { constants, zstdCompress, zstdDecompress } from 'node:zlib';

const compress = promisify(zstdCompress);
const decompress = promisify(zstdDecompress);

/**
 * zstd 압축 레벨. 2026-10 운영 값 실측(base64 포함 저장 크기 / 키당 압축 시간)에서
 * 레벨 1이 기본값 3보다 같거나 작고 더 빠르다: `bars:<SYM>:1Day` 32.8%·1.9ms vs
 * 36.2%·3.3ms, `bars:eodhist` 27.0% vs 27.5%. 6~12는 1%p 남짓 줄이려고 5~10배
 * 느려지고, 19는 28%지만 키당 200ms라 miss 경로에 둘 수 없다.
 */
const ZSTD_LEVEL = 1;

/**
 * 압축된 캐시 값의 표지. 값 = `PREFIX + base64(zstd(JSON))`.
 *
 * 이 문자열은 JSON으로 파싱되지 않으므로 Upstash의 자동 역직렬화가 손대지 않고 원문
 * 그대로 돌려준다 — 덕분에 읽기 쪽은 "문자열이고 이 접두사로 시작하는가"만 보면 된다.
 * 형식을 바꿀 때(코덱·인코딩 변경)는 새 접두사를 쓰고 옛 접두사 해독을 한동안 남긴다.
 *
 * base64는 Upstash REST가 JSON 본문이라 바이트를 그대로 실을 수 없어서 쓴다(+33%).
 * TCP 클라이언트(ElastiCache 등)로 옮기면 Buffer를 그대로 저장해 이 오버헤드를 없앨 수 있다.
 */
export const COMPRESSED_VALUE_PREFIX = 'zstd1:';

/**
 * 이 크기(직렬화된 JSON 바이트) 미만은 압축하지 않는다.
 *
 * 2026-10 운영 Redis 키 계열별 실측(zstd+base64 / 원본): 0.1KB 계열은 132~255%로
 * 오히려 커지고, 1KB 안팎(`fundamental:profile` 79%, `peers-raw` 60%)부터 이득이
 * 난다. 큰 값은 `bars:<SYM>:1Day`(658KB) ~33%, `bars:eodhist`(41KB) ~27%,
 * `financials:*`(2~6KB) 19~39%. 임계값 아래 값은 변경 전과 바이트 단위로 같게 저장된다.
 */
export const COMPRESSION_MIN_BYTES = 1024;

/**
 * `redis.set`에 넘길 값을 만든다. 압축이 이득일 때만 압축 문자열을, 아니면 `value`를
 * 그대로 돌려준다(Upstash 클라이언트가 평소처럼 JSON 직렬화한다).
 *
 * 압축은 libuv 스레드풀에서 돈다 — 600KB대 봉+지표 값을 이벤트 루프에서 동기 압축하면
 * 그동안 다른 요청이 멈춘다.
 */
export async function encodeCacheValue(value: unknown): Promise<unknown> {
    const json = JSON.stringify(value);
    // `undefined`·함수 등 JSON으로 표현되지 않는 값은 손대지 않는다.
    if (json === undefined) return value;

    const jsonBytes = Buffer.byteLength(json);
    if (jsonBytes < COMPRESSION_MIN_BYTES) return value;

    const encoded =
        COMPRESSED_VALUE_PREFIX +
        (
            await compress(Buffer.from(json), {
                params: { [constants.ZSTD_c_compressionLevel]: ZSTD_LEVEL },
            })
        ).toString('base64');
    // base64 접두사 문자열은 ASCII라 length가 곧 바이트 수다.
    return encoded.length < jsonBytes ? encoded : value;
}

/**
 * `redis.get` 결과를 원래 값으로 되돌린다. 압축 표지가 없는 값(압축 도입 전 엔트리,
 * 임계값 미만 값, miss의 `null`)은 그대로 통과한다.
 *
 * 압축 표지가 있는데 해독할 수 없으면 throw한다. 호출부는 이미 Redis 읽기 실패를
 * miss로 흡수하는 try/catch 안에서 부르므로, 깨진 엔트리는 refetch 후 덮어써진다.
 */
export async function decodeCacheValue(raw: unknown): Promise<unknown> {
    if (typeof raw !== 'string' || !raw.startsWith(COMPRESSED_VALUE_PREFIX)) {
        return raw;
    }
    const payload = Buffer.from(
        raw.slice(COMPRESSED_VALUE_PREFIX.length),
        'base64'
    );
    const json = (await decompress(payload)).toString('utf8');
    return JSON.parse(json) as unknown;
}
