import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Toaster } from 'react-hot-toast';
import { DataProvider } from '@/context/DataContext';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  // Providing all messages to the client side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <DataProvider>
        <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="flex h-screen bg-gray-100">
          <Sidebar locale={locale} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header pageTitle="" />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
              {children}
            </main>
          </div>
          <Toaster 
            position={locale === 'ar' ? 'top-right' : 'top-right'}
            toastOptions={{
              className: 'dark:bg-gray-800 dark:text-white',
              duration: 5000,
            }}
          />
        </div>
      </DataProvider>
    </NextIntlClientProvider>
  );
}
