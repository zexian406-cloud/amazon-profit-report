'use client';

import { ShopProvider } from '@/hooks/use-shops';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ShopProvider>{children}</ShopProvider>;
}