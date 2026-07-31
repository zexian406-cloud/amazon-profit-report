import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: '亚马逊利润报表',
    template: '%s | 亚马逊利润报表',
  },
  description: '亚马逊月度利润报表自动生成工具',
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
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-white">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">亚马逊利润报表系统</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">数据本地存储 · 安全可靠</span>
              </div>
            </header>
            <main className="flex-1 p-6 bg-gray-50/50">
              {children}
            </main>
          </SidebarInset>
          </Providers>
        </SidebarProvider>
      </body>
    </html>
  );
}