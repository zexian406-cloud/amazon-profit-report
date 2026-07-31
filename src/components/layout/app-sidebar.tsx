'use client';

import {
  LayoutDashboard,
  Upload,
  Table2,
  BarChart3,
  PieChart,
  History,
  Store,
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
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">利润报表</span>
            <span className="text-[10px] text-muted-foreground">Amazon Profit Report</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
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
      <div className="mt-auto border-t p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Store className="h-3 w-3" />
          <span>支持多店铺管理</span>
        </div>
      </div>
    </Sidebar>
  );
}