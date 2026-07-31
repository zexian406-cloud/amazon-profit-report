import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: '亚马逊利润测算',
    template: '%s | 亚马逊利润测算',
  },
  description: '亚马逊利润测算工具',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    title: '亚马逊利润测算',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        <SidebarProvider>
          <Providers>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/50 bg-white px-4 sticky top-0 z-10">
              <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
              <Separator orientation="vertical" className="mr-2 h-4 bg-border/50" />
              <span className="text-sm font-medium text-foreground/70">亚马逊利润测算</span>
            </header>
            <main className="flex-1 p-8 md:p-10 bg-[#F5F5F7]">
              <div className="mx-auto" style={{ maxWidth: '1200px' }}>
                {children}
              </div>
            </main>
          </SidebarInset>
          </Providers>
        </SidebarProvider>
      </body>
    </html>
  );
}