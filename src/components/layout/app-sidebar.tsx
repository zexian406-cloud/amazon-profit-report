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
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  {
    title: '概览',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    title: '数据导入',
    icon: Upload,
    href: '/import',
  },
  {
    title: '利润报表',
    icon: Table2,
    href: '/profit',
  },
  {
    title: '历史对比',
    icon: History,
    href: '/history',
  },
  {
    title: '费用分析',
    icon: PieChart,
    href: '/fees',
  },
  {
    title: '店铺管理',
    icon: Store,
    href: '/settings',
  },
  {
    title: '汇率管理',
    icon: BarChart3,
    href: '/exchange-rates',
  },
  {
    title: '使用说明',
    icon: BookOpen,
    href: '/help',
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 pb-3">
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">利润报表</span>
              <span className="text-[10px] text-sidebar-foreground/50">Amazon Profit Report</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
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
                      className="mx-2 h-11 rounded-lg data-[active=true]:bg-emerald-500/10 data-[active=true]:text-emerald-400 data-[active=true]:font-medium"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5" />
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
      <div className="mt-auto border-t border-sidebar-border/50 px-4 py-3">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <Store className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-sidebar-foreground/60">多店铺管理已启用</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <Store className="h-4 w-4 text-sidebar-foreground/40" />
          </div>
        )}
      </div>
    </Sidebar>
  );
}