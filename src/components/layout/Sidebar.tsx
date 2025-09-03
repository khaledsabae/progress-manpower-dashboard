'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, FileText, AlertTriangle, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  locale: string;
}

export function Sidebar({ locale }: SidebarProps) {
  const t = useTranslations('navigation');
  const pathname = usePathname();

  const navigation = [
    {
      name: t('overview'),
      href: `/${locale}`,
      icon: Home,
      current: pathname === `/${locale}` || pathname === `/${locale}/`,
    },
    {
      name: t('details'),
      href: `/${locale}/details`,
      icon: BarChart3,
      current: pathname === `/${locale}/details`,
    },
    {
      name: t('risks'),
      href: `/${locale}/risks`,
      icon: AlertTriangle,
      current: pathname === `/${locale}/risks`,
    },
  ];

  return (
    <div className="flex flex-col w-60 bg-gray-900 min-h-screen">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <FileText className="h-8 w-8 text-white" />
        <span className="ml-2 text-white text-lg font-semibold">
          Smart Dashboard
        </span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                item.current
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <Icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  item.current
                    ? 'text-white'
                    : 'text-gray-400 group-hover:text-white'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
