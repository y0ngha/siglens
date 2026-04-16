/* AdSense가 symbol 페이지 레이아웃을 깨뜨리지 못하도록 강제 스타일 주입.
 * 이 layout은 [symbol] 라우트에만 적용되므로 메인 페이지 스크롤에 영향을 주지 않는다. */
export default function SymbolLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <style
                dangerouslySetInnerHTML={{
                    __html: `html, body { height: 100% !important; overflow: hidden !important; }`,
                }}
            />
            {children}
        </>
    );
}
