'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchLanguage = (newLocale: string) => {
    // Ensure we only strip the leading locale segment if present
    let pathWithoutLocale = pathname;
    const leading = `/${locale}`;
    if (pathname === leading) {
      pathWithoutLocale = '';
    } else if (pathname.startsWith(`${leading}/`)) {
      pathWithoutLocale = pathname.slice(leading.length);
    }

    const query = searchParams?.toString();
    const qs = query && query.length > 0 ? `?${query}` : '';
    // Note: next/navigation does not expose hash, which is usually fine for app routes.
    router.push(`/${newLocale}${pathWithoutLocale}${qs}`);
  };

  return (
    <div className="flex items-center space-x-2 rtl:space-x-reverse" aria-label="Language switcher">
      <Globe className="h-4 w-4 text-gray-600" aria-hidden="true" />
      <div className="flex rounded-md border border-gray-300 overflow-hidden" role="group" aria-label="Select language">
        <button
          type="button"
          onClick={() => switchLanguage('ar')}
          aria-pressed={locale === 'ar'}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            locale === 'ar'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          العربية
        </button>
        <button
          type="button"
          onClick={() => switchLanguage('en')}
          aria-pressed={locale === 'en'}
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
