import { type NextRequest, NextResponse } from 'next/server';
import NodeCache from 'node-cache'; // مكتبة للتخزين المؤقت
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import {
    SHEET_NAMES,
    getProgressSheetData,
    getManpowerSheetData,
    getMaterialStatusData,
    getMechanicalPlanData,
    type ProgressSheetRow,
    type ManpowerSheetRow,
    type MaterialStatusRow,
    type MechanicalPlanRow,
} from '@/services/google-sheets';
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { parseSlashCommand, executeGrandeurCommand, formatResultForChat } from '@/services/grandeur';

// إعداد الكاش مع مدة تخزين ساعة واحدة (3600 ثانية)
const cache = new NodeCache({ stdTTL: 3600 });

// إعداد مفتاح API من المتغيرات البيئية
const API_KEY = process.env.GEMINI_API_KEY || '';
if (!API_KEY) {
    console.error("FATAL: GEMINI_API_KEY environment variable is not set.");
    throw new Error("API Key is missing.");
}

// تهيئة نموذج Gemini AI
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ],
});

// تهيئة LLM للردود
const llm = new ChatGoogleGenerativeAI({ apiKey: API_KEY, model: "gemini-1.5-flash" });

// قالب الموجه لتحليل سؤال المستخدم (NLU)
const nluPromptTemplate = `
Analyze the user's question about the Mowaih Power Plant project status. Your task is to identify the intent and extract relevant keywords. Return the result as a JSON object with "intent" (e.g., "GET_PROGRESS", "GREETING", "UNKNOWN") and "keywords" (array of significant terms). If the intent is unclear, use "UNKNOWN".

User Question: "{user_query}"
Your JSON Output:
`;

// قالب الموجه للردود
const answerPromptTemplate = ChatPromptTemplate.fromMessages([
    [
        "system",
        `You are Khaled Sabae, a Senior Mechanical Projects Engineer at Alfanar, currently working on the Mowaih PV 380/110 kV BSP project. Your core responsibilities involve HVAC, Firefighting, and Plumbing systems. Answer the user's questions based ONLY on this provided data and the chat history. Be concise, factual, and use a professional yet slightly informal tone (Egyptian Arabic is preferred when appropriate). If the data doesn't provide the answer, explicitly state that the information is unavailable. Today's date is ${new Date().toLocaleDateString('en-CA')}.

        Available real-time data snippets:
        - Progress Summary: {progress_data}
        - Material Status Summary: {material_data}
        - Mechanical Plan Summary: {plan_data}`
    ],
    new MessagesPlaceholder("chat_history"),
    ["user", "{input}"],
]);

// تعريف أنواع البيانات لنتائج Promise.allSettled ولكاش البيانات
// تأكد أن TypeScript يستخدم lib ES2020 أو أحدث، أو قم بتعريف PromiseSettledResult يدويًا إذا لزم الأمر.
// type PromiseSettledResult<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: any };

type ProgressSheetResult = PromiseSettledResult<ProgressSheetRow[]>;
type ManpowerSheetResult = PromiseSettledResult<ManpowerSheetRow[]>;
type MaterialStatusResult = PromiseSettledResult<MaterialStatusRow[]>;
type MechanicalPlanResult = PromiseSettledResult<MechanicalPlanRow[]>;

type FetchSheetDataReturnType = [
    ProgressSheetResult,
    ManpowerSheetResult,
    MaterialStatusResult,
    MechanicalPlanResult
];

// دالة لجلب البيانات من Google Sheets مع التخزين المؤقت
async function fetchSheetData(): Promise<FetchSheetDataReturnType> {
    const cachedData = cache.get<FetchSheetDataReturnType>('sheetData');
    if (cachedData) {
        console.log('[DEBUG] جلب البيانات من الكاش');
        return cachedData;
    }

    console.log('[DEBUG] جلب البيانات من Google Sheets...');
    const results = await Promise.allSettled([
        getProgressSheetData(SHEET_NAMES.PROGRESS),
        getManpowerSheetData(SHEET_NAMES.MANPOWER),
        getMaterialStatusData(SHEET_NAMES.MATERIAL),
        getMechanicalPlanData(SHEET_NAMES.PLAN),
    ]);

    // TypeScript should correctly infer the tuple type here if getProgressSheetData etc. have specific Promise return types.
    // Adding 'as FetchSheetDataReturnType' for explicit assertion.
    const typedResults = results as FetchSheetDataReturnType;

    cache.set('sheetData', typedResults);
    console.log('[DEBUG] تم حفظ البيانات في الكاش');
    return typedResults;
}

// دالة لتحليل سؤال المستخدم (NLU)
async function recognizeIntent(input: string): Promise<{ intent: string; keywords: string[] }> {
    const finalPrompt = nluPromptTemplate.replace('{user_query}', input);
    const response = await model.generateContent(finalPrompt);
    const text = response.response.text();
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            return JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.error('[DEBUG] فشل تحليل JSON:', e);
        }
    }
    return { intent: 'UNKNOWN', keywords: [] };
}

// دالة رئيسية لمعالجة طلبات POST
export async function POST(req: NextRequest) {
    console.log('\n--- [API /api/chat] New Chat Request ---');
    try {
        const { message, history } = await req.json();
        console.log('[DEBUG] Received User Query:', message);

        // التحقق من صحة الرسالة
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
        }

        // Project Grandeur: Handle slash-commands early (Module 1)
        if (message.trim().startsWith('/')) {
            try {
                const locale = /[\u0600-\u06FF]/.test(message) ? 'ar' : 'en';
                const parsed = parseSlashCommand(message);
                const exec = await executeGrandeurCommand({
                    command: parsed.command,
                    args: parsed.args,
                    locale,
                });
                const replyText = formatResultForChat(exec, locale);
                return NextResponse.json({ reply: replyText });
            } catch (e: any) {
                console.error('[API /api/chat] Grandeur command error:', e);
                const errMsg = /[\u0600-\u06FF]/.test(message)
                    ? `خطأ أثناء تنفيذ الأمر: ${e?.message || 'Unknown error'}`
                    : `Error executing command: ${e?.message || 'Unknown error'}`;
                return NextResponse.json({ reply: errMsg }, { status: 500 });
            }
        }

        // 1. جلب البيانات من الكاش أو Google Sheets
        const results = await fetchSheetData(); // الآن results هيكون نوعها FetchSheetDataReturnType
        const progressResult = results[0];     // ده هيكون ProgressSheetResult
        const manpowerResult = results[1];     // ده هيكون ManpowerSheetResult
        const materialResult = results[2];     // ده هيكون MaterialStatusResult
        const planResult = results[3];         // ده هيكون MechanicalPlanResult

        const progressData: ProgressSheetRow[] = progressResult.status === 'fulfilled' ? progressResult.value : [];
        const manpowerData: ManpowerSheetRow[] = manpowerResult.status === 'fulfilled' ? manpowerResult.value : [];
        const materialData: MaterialStatusRow[] = materialResult.status === 'fulfilled' ? materialResult.value : [];
        const planData: MechanicalPlanRow[] = planResult.status === 'fulfilled' ? planResult.value : [];

        // تحضير سياق البيانات
        const progressContext = progressData.length > 0 ? progressData.slice(0, 3).map(r => `- ${r.buildingName}(${r.floorRoom}): HVAC ${r.hvacPercentage ?? 'NA'}%, FF ${r.firefightingPercentage ?? 'NA'}%`).join('\n') : "غير متوفر";
        const materialContext = materialData.length > 0 ? materialData.slice(0, 3).map(r => `- ${r.itemDescription}: الحالة ${r.deliveryStatus ?? 'NA'}`).join('\n') : "غير متوفر";
        const planContext = planData.length > 0 ? planData.slice(0, 3).map(r => `- ${r.mechanicalActivitySystem} (${r.areaBuilding}): تبدأ ${r.calculatedStartDateString ?? 'غير محدد'}`).join('\n') : "غير متوفر";

        // 2. تحليل سؤال المستخدم (NLU)
        const nluResult = await recognizeIntent(message);
        const { intent, keywords } = nluResult;
        console.log('[DEBUG] NLU Result:', { intent, keywords });

        // 3. توليد الرد بناءً على الـ intent
        let reply = "آسف، المعلومات المطلوبة غير متوفرة.";
        switch (intent) {
            case 'GREETING':
                reply = "أهلًا بك! كيف يمكنني المساعدة في متابعة مشروع المويه اليوم؟";
                break;
            case 'GET_PROGRESS':
                if (progressData.length > 0) {
                    reply = `حالة التقدم: \n${progressContext}`;
                } else {
                    reply = "مفيش بيانات تقدم متاحة حاليًا.";
                }
                break;
            case 'GET_MATERIAL':
                if (materialData.length > 0) {
                    reply = `حالة المواد: \n${materialContext}`;
                } else {
                    reply = "مفيش بيانات مواد متاحة حاليًا.";
                }
                break;
            case 'GET_MANPOWER':
                if (manpowerData.length > 0) {
                    // ملحوظة: manpowerData هي مصفوفة من السجلات، وليس مجرد عدد.
                    // إذا كنت تريد عرض عدد الصفوف (العمال مثلًا)، يمكن استخدام manpowerData.length
                    // لكن السياق هنا يعتمد على كيفية تعريف ManpowerSheetRow وما إذا كانت تحتوي على تفاصيل الأفراد.
                    // الرد الحالي يفترض أنك تريد معرفة ما إذا كانت هناك بيانات متاحة بشكل عام.
                    // لتعديل الرد ليعكس عدد الأفراد، تأكد من أن manpowerData.length هو ما تقصده.
                    // على سبيل المثال: reply = `القوى العاملة: ${manpowerData.length} سجل متاح حاليًا.`;
                    // أو إذا كان كل صف يمثل عاملًا واحدًا: reply = `القوى العاملة: يتوفر ${manpowerData.length} عامل.`;
                    // الرد الأصلي كان `القوى العاملة: ${manpowerData.length} فرد متاحين حاليًا.` وهو مناسب لو كل صف يمثل فرد.
                    reply = `القوى العاملة: ${manpowerData.length} فرد متاحين حاليًا.`;
                } else {
                    reply = "مفيش بيانات قوى عاملة متاحة حاليًا.";
                }
                break;
            case 'COUNT_BUILDINGS':
                reply = `عدد المباني في بيانات التقدم: ${progressData.length} مبنى.`;
                break;
            case 'GET_PLAN':
                if (planData.length > 0) {
                    reply = `الخطة الميكانيكية: \n${planContext}`;
                } else {
                    reply = "مفيش بيانات خطة ميكانيكية متاحة حاليًا.";
                }
                break;
            default:
                console.log("[DEBUG] Intent: UNKNOWN. Using LLM directly.");
                try {
                    const chatHistory: BaseMessage[] = (history || []).map((msg: { role: string; content: string }) =>
                        msg.role === "user" ? new HumanMessage(msg.content) : new AIMessage(msg.content)
                    );
                    const finalAnswerPrompt = await answerPromptTemplate.formatMessages({
                        input: message,
                        chat_history: chatHistory,
                        progress_data: progressContext,
                        material_data: materialContext,
                        plan_data: planContext,
                    });
                    const result = await llm.invoke(finalAnswerPrompt);
                    reply = typeof result?.content === 'string' ? result.content : "لم أتمكن من العثور على إجابة مناسبة.";
                } catch (e: any) {
                    console.error("Error during LLM invocation:", e);
                    reply = `آسف، حدث خطأ: ${e.message}`;
                }
                break;
        }

        // 4. إرجاع الرد
        if (!reply || reply.trim() === '') {
            reply = "لم أتمكن من فهم الطلب أو العثور على معلومات. حاول إعادة صياغة السؤال.";
            console.warn("[WARN] Generated empty reply, sending fallback.");
        }
        console.log('[DEBUG] Sending Final Reply:', reply);
        return NextResponse.json({ reply });

    } catch (error) {
        console.error('[API /api/chat] UNHANDLED Error in POST handler:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred.';
        return NextResponse.json({ error: 'حدث خطأ داخلي في السيرفر.', details: errorMessage }, { status: 500 });
    }
}