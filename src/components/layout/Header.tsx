'use client';

import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  pageTitle: string;
}

export function Header({ pageTitle }: HeaderProps) {
  const t = useTranslations('header');

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {pageTitle}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('title')}
          </p>
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
