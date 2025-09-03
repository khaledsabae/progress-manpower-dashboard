'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = (newLocale: string) => {
    // Remove the current locale from the pathname
    const pathWithoutLocale = pathname.replace(`/${locale}`, '');
    // Navigate to the new locale
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  return (
    <div className="flex items-center space-x-2 rtl:space-x-reverse">
      <Globe className="h-4 w-4 text-gray-600" />
      <div className="flex rounded-md border border-gray-300 overflow-hidden">
        <button
          onClick={() => switchLanguage('ar')}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            locale === 'ar'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          العربية
        </button>
        <button
          onClick={() => switchLanguage('en')}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            locale === 'en'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          English
        </button>
      </div>
    </div>
  );
}
