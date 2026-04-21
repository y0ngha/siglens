import { SymbolLayoutClient } from './SymbolLayoutClient';
import type { ReactNode } from 'react';

interface SymbolLayoutProps {
    children: ReactNode;
}

export default function SymbolLayout({ children }: SymbolLayoutProps) {
    return <SymbolLayoutClient>{children}</SymbolLayoutClient>;
}
