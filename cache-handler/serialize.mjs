import { gzipSync, gunzipSync } from 'node:zlib';

// RSC/HTML 페이로드가 커서 gzip 필수. 메타(lastModified/tags 등)도 함께 직렬화한다.
export function serialize(obj) {
    return gzipSync(Buffer.from(JSON.stringify(obj)));
}

export function deserialize(buf) {
    return JSON.parse(gunzipSync(buf).toString('utf-8'));
}
