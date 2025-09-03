// src/app/api/risks/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// --- Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Gemini Prompt Engineering ---
const expectedJsonFormat = `{
  "riskDescription": "...",
  "systemFocus": "HVAC | Fire Protection | Plumbing | Electrical Interface | Civil Interface | Safety | Schedule | Cost | Other",
  "likelyCauses": "...",
  "potentialImpactConsequence": "...",
  "likelihood": "Low | Medium | High",
  "severityImpactLevel": "Low | Medium | High | Critical",
  "riskLevelScore": "Low | Medium | High | Critical",
  "riskCategory": "Technical | Safety | Schedule | Cost | Environmental | External | Operational | Other",
  "mitigationStrategiesActions": "..."
}`;

function createGeminiPrompt(naturalLanguageDescription: string): string {
    return `You are an expert Risk Analysis Assistant for large-scale electrical power station construction projects in Saudi Arabia, specifically focusing on the Mowaih PV 380/110 kV BSP project. Your task is to analyze the following risk description provided by a Senior Mechanical Project Engineer and extract structured information suitable for a risk register.

Project Context: Mowaih PV 380/110 kV BSP, focus on Mechanical Systems (HVAC, Firefighting, Plumbing) but consider interfaces.

User Input Risk Description:
"${naturalLanguageDescription}"

Your Task:
Analyze the description and generate a JSON object containing the following fields based *only* on the provided description and project context. If information for a field is not clearly present or inferable, use "TBD" or make a reasonable assumption based on typical project risks.

Required JSON Output Fields:
1.  "riskDescription": A concise summary of the core risk.
2.  "systemFocus": The primary system affected (e.g., HVAC, Fire Protection, Plumbing, Electrical Interface, Civil Interface, Safety, Schedule, Cost, Other). Choose the most relevant.
3.  "likelyCauses": Potential reasons for the risk occurring.
4.  "potentialImpactConsequence": What could happen if the risk materializes (impact on cost, time, quality, safety etc.).
5.  "likelihood": Estimated probability (Low, Medium, High). Default to "Medium" if unsure.
6.  "severityImpactLevel": Estimated severity of the impact (Low, Medium, High, Critical). Estimate based on the described consequence.
7.  "riskLevelScore": Overall risk level based on likelihood and severity (Low, Medium, High, Critical). Use a standard risk matrix logic (e.g., High Severity + Medium Likelihood = High Risk).
8.  "riskCategory": Classify the risk (e.g., Technical, Safety, Schedule, Cost, Environmental, External, Operational, Other). Choose the most fitting category.
9.  "mitigationStrategiesActions": Suggest 1-2 potential mitigation actions. Keep it brief and practical. Use "TBD" if no clear action is suggested by the input.

Output Format: Return *only* the JSON object. Make sure it is a valid JSON.
Example (Ideal Output, no backticks needed if responseMimeType is set):
{
  "riskDescription": "Delay in main transformer delivery impacting schedule",
  "systemFocus": "Schedule",
  "likelyCauses": "Customs clearance issues",
  "potentialImpactConsequence": "Project delay, potential penalties",
  "likelihood": "Medium",
  "severityImpactLevel": "High",
  "riskLevelScore": "High",
  "riskCategory": "Schedule",
  "mitigationStrategiesActions": "Early procurement planning, engage customs broker proactively."
}

Now, analyze the user input provided above and generate the JSON output.
`;
}

// --- POST Handler (Analyze ONLY) ---
export async function POST(request: NextRequest) {
    console.log("--- Analyze API Route Start ---");

    // 1. Check Gemini API Key
    if (!GEMINI_API_KEY) {
        console.error("!!! Analyze API Error: GEMINI_API_KEY missing.");
        return NextResponse.json({ message: "Server configuration error: Gemini API Key missing." }, { status: 500 });
    }
    console.log("Gemini API Key Check Passed.");

    // 2. Parse Request Body
    let description: string;
    try {
        console.log("Parsing request body...");
        const body = await request.json();
        description = body.description;
        if (!description || typeof description !== 'string' || description.trim() === '') {
            console.log("Validation Error: Description missing or invalid.");
            return NextResponse.json({ message: "Risk description is required." }, { status: 400 });
        }
        console.log("Received description for analysis:", description);
    } catch (e) {
        console.error("Error parsing request body:", e);
        return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    // 3. Call Gemini API and Return Result
    // *** Declare variables outside the try block ***
    let responseText: string | null = null;
    let cleanedJsonString = '';
    let riskDataJson: any;

    try {
        console.log("Calling Gemini API for analysis...");
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const generationConfig = { temperature: 0.3, topK: 1, topP: 1, maxOutputTokens: 2048, responseMimeType: "application/json" };
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const prompt = createGeminiPrompt(description);
        const result = await model.generateContent(prompt);
        console.log("Gemini API Call Successful.");

        try {
            console.log("Step 2.1: Parsing Gemini Response...");
            const response = result.response;
            // *** Assign value inside the try block ***
            responseText = response.text();

            if (!responseText) {
                const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text;
                 if (candidateText) {
                     console.warn("Gemini response.text() was empty, using candidate text.");
                     responseText = candidateText; // Assign to the outer scoped variable
                 } else {
                     console.error("!!! Gemini response content is missing or empty.");
                     console.log("Full Gemini Response object:", JSON.stringify(response, null, 2));
                     if (response.promptFeedback?.blockReason) { throw new Error(`Gemini request blocked: ${response.promptFeedback.blockReason}`); }
                     throw new Error("No valid text found in Gemini response to parse.");
                 }
            }
            // Ensure responseText is not null before proceeding
             if (responseText === null) {
                 throw new Error("Could not retrieve text from Gemini response.");
             }

            console.log("Raw Gemini Response Text:", responseText);

            // --- Cleaning Step ---
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                cleanedJsonString = jsonMatch[1].trim();
                console.log("Extracted JSON string from code fence.");
            } else {
                cleanedJsonString = responseText.trim();
                if (!cleanedJsonString.startsWith('{') || !cleanedJsonString.endsWith('}')) {
                     console.warn("Cleaned response text doesn't look like standard JSON object:", cleanedJsonString.substring(0, 50) + "...");
                }
            }
            // --- End Cleaning Step ---

            console.log("Cleaned JSON String (Attempting to parse):", cleanedJsonString);
            riskDataJson = JSON.parse(cleanedJsonString);
            console.log("Gemini Response Parsed Successfully.");

            // --- Return ONLY the analyzed JSON data ---
            console.log("Returning analyzed data to frontend.");
            return NextResponse.json(riskDataJson, { status: 200 });

        } catch (parseError: any) {
            console.error("!!! Error parsing cleaned Gemini response:", parseError);
            console.log("Cleaned JSON String (that failed parsing):", cleanedJsonString);
             // *** Now responseText is accessible here ***
            console.log("Original Raw Gemini Response (for debugging):", responseText ?? "responseText was null");
            throw new Error(`Failed to parse AI response. Check Gemini output format. Error: ${parseError.message}`);
        }

    } catch (error: any) {
        console.error("!!! Error in Analyze API POST handler:", error);
        return NextResponse.json({ message: error.message || "An internal server error occurred during analysis." }, { status: 500 });
    } finally {
        console.log("--- Analyze API Route End ---");
    }
}