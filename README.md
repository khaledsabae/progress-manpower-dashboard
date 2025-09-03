<<<<<<< HEAD
# Smart Project Dashboard

لوحة معلومات المشروع الذكية - تطبيق ويب ثنائي اللغة (العربية/الإنجليزية) يعرض مؤشرات الأداء الرئيسية من Google Sheets مع رؤى ذكية مدعومة بالذكاء الاصطناعي.

## الميزات الرئيسية

- **اتصال مباشر بـ Google Sheets**: عرض البيانات في الوقت الفعلي
- **تصور البيانات التفاعلي**: رسوم بيانية وجداول تفاعلية
- **هيكل متعدد الصفحات**: نظرة عامة، تفاصيل هندسية، سجل المخاطر
- **رؤى ذكية بالذكاء الاصطناعي**: تنبؤات وتحليلات مدعومة بـ Gemini AI
- **دعم ثنائي اللغة كامل**: العربية والإنجليزية مع تبديل سلس
- **واجهة مستخدم حديثة ومتجاوبة**: تصميم يتبع أفضل الممارسات

## التقنيات المستخدمة

- **Framework**: Next.js 15 مع App Router
- **اللغة**: TypeScript
- **التصميم**: Tailwind CSS
- **الأيقونات**: Lucide React
- **الرسوم البيانية**: Recharts
- **التدويل**: next-intl
- **الذكاء الاصطناعي**: Google Gemini API
- **مصدر البيانات**: Google Sheets API

## التثبيت والتشغيل

1. **تثبيت المتطلبات**:
```bash
npm install
```

2. **إعداد متغيرات البيئة**:
إنشاء ملف `.env.local` مع المتغيرات المطلوبة (انظر `.env.example`)

3. **تشغيل التطبيق**:
```bash
npm run dev
```

4. **فتح التطبيق**:
افتح [http://localhost:3000](http://localhost:3000) في المتصفح

## هيكل المشروع

```
src/
├── app/
│   ├── [locale]/          # التوجيه المبني على اللغة
│   │   ├── layout.tsx     # التخطيط الرئيسي
│   │   ├── page.tsx       # صفحة النظرة العامة
│   │   ├── details/       # صفحة التفاصيل الهندسية
│   │   └── risks/         # صفحة سجل المخاطر
│   ├── api/               # نقاط النهاية للـ API
│   │   ├── project-data/  # جلب بيانات المشروع
│   │   └── ai-insights/   # الرؤى الذكية
│   └── globals.css        # الأنماط العامة
├── components/            # المكونات القابلة لإعادة الاستخدام
│   ├── layout/           # مكونات التخطيط
│   ├── ui/               # مكونات واجهة المستخدم الأساسية
│   └── [data-components] # مكونات عرض البيانات
├── lib/                  # الخدمات والمساعدات
│   ├── googleSheets.ts   # خدمة Google Sheets
│   ├── gemini.ts         # خدمة Gemini AI
│   └── utils.ts          # دوال مساعدة
└── messages/             # ملفات الترجمة
    ├── ar.json           # الترجمة العربية
    └── en.json           # الترجمة الإنجليزية
```

## متغيرات البيئة المطلوبة

```env
# Google Sheets API
GOOGLE_CREDENTIALS_BASE64=your_base64_encoded_service_account_json
NEXT_PUBLIC_GOOGLE_SHEET_ID=your_google_sheet_id

# Gemini AI API
GEMINI_API_KEY=your_gemini_api_key

# Site Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## الاستخدام

### صفحة النظرة العامة
- عرض مؤشرات الأداء الرئيسية
- بطاقات التقدم الإجمالي وحالة القوى العاملة
- رؤى ذكية مدعومة بالذكاء الاصطناعي
- رسوم بيانية تفاعلية للجدول الزمني

### صفحة التفاصيل الهندسية
- جدول مفصل للخطة الميكانيكية
- تتبع تقدم المهام
- معلومات التكليف والحالة

### صفحة سجل المخاطر
- عرض شامل لجميع مخاطر المشروع
- تصنيف المخاطر حسب المستوى
- إحصائيات ملخصة للمخاطر

## المساهمة

1. Fork المشروع
2. إنشاء فرع للميزة الجديدة (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add some AmazingFeature'`)
4. Push إلى الفرع (`git push origin feature/AmazingFeature`)
5. فتح Pull Request

## الترخيص

هذا المشروع مرخص تحت رخصة MIT - انظر ملف [LICENSE](LICENSE) للتفاصيل.
=======
# progress-manpower-dashboard
>>>>>>> d51fef8a78b10b4d445a0336e3a04e83e54cc6b7
