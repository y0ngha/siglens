interface JsonLdProps {
    data: Record<string, unknown>;
}

// `<` 이스케이프: script 태그 내 JSON에 `</script>`가 포함될 경우 파싱이 조기 종료되는 것을 방지.
export function JsonLd({ data }: JsonLdProps) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data).replace(/</g, '\\u003c'),
            }}
        />
    );
}
