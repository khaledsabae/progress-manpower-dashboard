import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';

const locales = ['ar', 'en'] as const;

export default getRequestConfig(async ({requestLocale}) => {
  // `requestLocale` needs to be awaited.
  const requested = await requestLocale;

  // The result can be undefined, so a fallback is necessary.
  const locale = locales.includes(requested as any)
    ? requested
    : 'ar'; // default locale

  if (!locales.includes(locale as any)) notFound();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});

// This file is used by the middleware and the app router
// to provide the correct messages for the requested locale.
