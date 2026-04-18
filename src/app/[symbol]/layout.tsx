import { SymbolLayoutClient } from './SymbolLayoutClient';

export default function SymbolLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <SymbolLayoutClient>{children}</SymbolLayoutClient>;
}
