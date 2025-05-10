// src/services/ai-service.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { WorkedOnActivity, DailyReportData } from '@/types'; // Verify path

// Interface includes language and expects the NEW workedOnActivities structure
interface AiSummaryInputData {
  reportDate: string | null;
  historicalManpower: number | null; // Represents PREVIOUS day's manpower
  workedOnActivities: DailyReportData['workedOnActivities']; // Expects {hvac?, ff?, fa?, other?} structure
  totalWorkedOn: number;
  overallProgressChange?: number | null;
  delayedActivitiesCount?: number | null;
  language: 'en' | 'ar';
}

// Helper to format activities using the NEW structure
function formatActivitiesForPrompt(activities: DailyReportData['workedOnActivities']): string {
    // Handle null or undefined input gracefully
    if (!activities) {
        console.warn("formatActivitiesForPrompt received null activities object.");
        return "No progress data available.";
    }

    let formattedString = "";

    // Helper to format a specific category list
    const formatList = (title: string, list: WorkedOnActivity[] | undefined | null) => { // Accept null as well
        // Check if list exists and has items
        if (list && Array.isArray(list) && list.length > 0) {
            formattedString += `\n**${title} (${list.length}):**\n`;
            list.forEach(act => {
                // Basic validation for activity object
                if (!act || typeof act !== 'object') return;

                formattedString += `- ${act.name || 'Unknown Activity'}`;
                if (act.location) { formattedString += ` (${act.location})`; }
                // Safely format progress and delta
                const progressText = (typeof act.progress === 'number' && !isNaN(act.progress))
                    ? `${act.progress.toFixed(0)}%` : 'N/A';
                formattedString += `: ${progressText}`;
                if (typeof act.delta === 'number' && !isNaN(act.delta) && act.delta > 0.01) {
                    formattedString += ` (+${act.delta.toFixed(1)}% progression)`;
                }
                if (act.remarks) { formattedString += ` [Remarks: ${act.remarks}]`; }
                formattedString += "\n";
            });
        }
    };

    // Call formatList for the NEW categories from the activities object
    formatList("HVAC Activities", activities.hvac);
    formatList("Firefighting Activities", activities.ff);
    formatList("Fire Alarm Activities", activities.fa);
    formatList("Other Activities", activities.other);

    // Return appropriate message if no activities were formatted
    if (formattedString.trim() === "") {
         return "No specific activities showed progress during this period.";
    }

    return formattedString.trim();
}


// Function accepts updated AiSummaryInputData (with language)
export async function getAiSummary(inputData: AiSummaryInputData): Promise<string> {
    // API Key Check
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Gemini API Key is missing in environment variables.");
        // Consider throwing a more specific error or returning a user-facing message
        throw new Error("API Key configuration error. Cannot generate AI summary.");
    }

    // Destructure input data, including language
    const {
        reportDate,
        historicalManpower, // Note: This is PREVIOUS day's manpower
        workedOnActivities,
        totalWorkedOn,
        overallProgressChange,
        delayedActivitiesCount,
        language
    } = inputData;

    // Handle case where no activities progressed (return bilingual message)
    if (!workedOnActivities || totalWorkedOn <= 0) {
        return language === 'ar'
            ? "لم يتم الإبلاغ عن تقدم ملحوظ لهذا اليوم."
            : "No significant progress reported for this day.";
    }

    // Initialize AI Model
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); // Using flash for speed/cost

    // Format activities for the prompt using the updated helper
    const formattedActivities = formatActivitiesForPrompt(workedOnActivities);

    // Determine language instruction for the prompt
    const languageInstruction = language === 'ar'
        ? "الرجاء إنشاء الملخص باللغة العربية."
        : "Please generate the summary in English.";

    // Construct the final prompt with all updates
    const prompt = `
You are an expert project controls engineer assigned to the Mowaih PV 380/110 kV BSP project. Your task is to generate a concise daily progress summary based on the provided data.

**Report Date:** ${reportDate || 'N/A'}
**Total Workforce During Activities:** ${historicalManpower ?? 'N/A'} (This reflects manpower on the day the work was performed)
**Total Activities Showing Progress:** ${totalWorkedOn}
${overallProgressChange !== null && overallProgressChange !== undefined ? `**Overall Project Progress Change (since previous report):** ${overallProgressChange.toFixed(1)}%\n` : ''}
${delayedActivitiesCount !== null && delayedActivitiesCount !== undefined ? `**Number of Currently Delayed Activities:** ${delayedActivitiesCount}\n` : ''}

**Analysis of Progressed Activities:**
The following ${totalWorkedOn} activities showed progress during the reporting period compared to the previous snapshot:
${formattedActivities}

**Instructions for Summary Generation:**
- Write a brief narrative summary (1-2 paragraphs maximum) suitable for a daily management report.
- Start by mentioning the report date and the total workforce involved during the activities reported.
- Summarize the key areas where progress was made (mention disciplines like HVAC, Firefighting, Fire Alarm if they have significant activity).
- Highlight 1-3 significant advancements based on the data (e.g., large percentage increases, activities nearing completion >85%, newly started activities, important systems like GIS or Control Building).
- Briefly mention any critical remarks noted, if any seem important.
- If the number of delayed activities is provided and greater than 0, mention it briefly.
- Maintain a professional and concise tone. Avoid simply re-listing all the activities; provide a synthesized overview focusing on impactful changes. Do not invent information not present in the data.
- **${languageInstruction}**
`.trim();

    // Generation Configuration
    const generationConfig = {
        temperature: 0.5,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048, // Ample length for summary
    };

    // Safety Settings
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
    ];

    // Call the API
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings,
        });

        // Process the response
        const response = result.response;
        // Check for issues in the response itself before getting text
        if (!response) {
            console.error("Gemini API returned undefined response.");
            throw new Error("AI summary generation failed: No response received.");
        }
        if (response.promptFeedback?.blockReason) {
             console.error("Prompt blocked by API:", response.promptFeedback.blockReason, response.promptFeedback.safetyRatings);
             throw new Error(`AI summary generation blocked: ${response.promptFeedback.blockReason}.`);
        }
        if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
             console.error("Gemini API returned no valid candidates in response:", response);
             // Check finish reason if available
             const finishReason = response.candidates?.[0]?.finishReason;
             if (finishReason && finishReason !== 'STOP') {
                 throw new Error(`AI summary generation failed: Finish reason - ${finishReason}.`);
             }
             throw new Error("AI summary generation failed: No content received.");
        }

        // Extract and return the text
        const summaryText = response.text(); // Use response.text() helper
        return summaryText.trim();

    } catch (error) {
        // Log the specific error and re-throw a user-friendly message
        console.error("Error calling Gemini API or processing response:", error);
        // Avoid exposing raw error details potentially containing sensitive info
        if (error instanceof Error && error.message.startsWith("AI summary generation blocked")) {
             throw error; // Re-throw specific block error
        }
        if (error instanceof Error && error.message.startsWith("AI summary generation failed")) {
            throw error; // Re-throw specific failure error
        }
        // Generic error for other issues
        throw new Error("Failed to generate AI summary due to an unexpected error. Check service logs.");
    }
}