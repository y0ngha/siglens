import { SymbolLayoutClient } from './SymbolLayoutClient';
import { ReactNode } from 'react';

export default function SymbolLayout({ children }: { children: ReactNode }) {
    return <SymbolLayoutClient>{children}</SymbolLayoutClient>;
}
