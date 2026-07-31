'use client';

import {
  LayoutDashboard,
  Upload,
  Table2,
  BarChart3,
  PieChart,
  History,
  Store,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: '概览', icon: LayoutDashboard, href: '/' },
  { title: '数据导入', icon: Upload, href: '/import' },
  { title: '利润报表', icon: Table2, href: '/profit' },
  { title: '历史对比', icon: History, href: '/history' },
  { title: '费用分析', icon: PieChart, href: '/fees' },
  { title: '店铺管理', icon: Store, href: '/settings' },
  { title: '汇率管理', icon: BarChart3, href: '/exchange-rates' },
  { title: '使用说明', icon: BookOpen, href: '/help' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-[#2C2C2E] pb-4">
        <div className="flex items-center gap-3 px-3 pt-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007AFF]">
            <span className="text-sm font-semibold text-white">P</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-white">利润报表</span>
              <span className="text-[10px] text-white/70 font-normal">Profit Report</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="mx-2 h-9 rounded-lg text-sm font-normal text-[#8E8E93] hover:text-white hover:bg-white/5 data-[active=true]:bg-[#007AFF]/15 data-[active=true]:text-[#007AFF] data-[active=true]:font-medium group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}