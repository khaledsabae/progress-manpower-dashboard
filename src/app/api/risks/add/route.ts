// src/app/api/risks/add/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { google, sheets_v4 } from 'googleapis';
import { type RiskRegisterItem } from '@/services/google-sheets';

// --- Configuration ---
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const RISK_REGISTER_SHEET_NAME = process.env.RISK_REGISTER_SHEET_NAME || 'RiskRegister';
const GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
const RISK_ID_PREFIX = "MR";

// --- Helper: Initialize Sheets Client ---
async function getSheetsClient() {
    if (!GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
        console.error("!!! Sheets Client Error (Add API): Credentials missing from env");
        throw new Error("Google Service Account credentials are not configured in environment variables.");
    }
    try {
        console.log("Parsing Service Account Credentials (Add API)...");
        const credsString = GOOGLE_SERVICE_ACCOUNT_CREDENTIALS.trim();
        if (!credsString.startsWith('{') || !credsString.endsWith('}')) {
             console.error("!!! Invalid format detected for GOOGLE_SERVICE_ACCOUNT_CREDENTIALS.");
              throw new Error("Invalid format for Google Service Account credentials.");
        }
        const credentials = JSON.parse(credsString);
        console.log("Credentials Parsed Successfully (Add API). Authenticating...");
        const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
        const client = await auth.getClient();
        console.log("Google Auth Client obtained (Add API).");
        const sheets = google.sheets({ version: 'v4', auth: client as any });
        console.log("Sheets Client Initialized (Add API).");
        return sheets;
    } catch (e: any) {
        console.error("!!! Error initializing Google Sheets client (Add API):", e);
         if (e instanceof SyntaxError) {
             console.error("!!! Hint: Check the formatting of GOOGLE_SERVICE_ACCOUNT_CREDENTIALS in your .env.local file.");
         }
        throw new Error(`Failed to initialize Google Sheets client: ${e.message}`);
    }
}

// --- Helper: Generate Next Risk ID ---
async function getNextRiskId(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string, prefix: string): Promise<string> {
    const range = `${sheetName}!A2:A`;
    let lastNumber = 0;
    try {
        console.log(`Reading range '${range}' to find last Risk ID...`);
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        const values = response.data.values;
        if (values && values.length > 0) {
            console.log(`Found ${values.length} existing rows in Risk ID column.`);
            for (let i = values.length - 1; i >= 0; i--) {
                if (values[i] && values[i][0]) {
                    const lastId = String(values[i][0]).trim();
                    if (lastId.startsWith(prefix + "-")) {
                        const numberPart = lastId.substring(prefix.length + 1);
                        const currentNum = parseInt(numberPart, 10);
                        if (!isNaN(currentNum)) {
                            lastNumber = Math.max(lastNumber, currentNum);
                        }
                    }
                }
            }
             console.log(`Highest number found for prefix '${prefix}': ${lastNumber}`);
        } else {
            console.log(`No existing Risk IDs found in range '${range}'. Starting sequence from 1.`);
            lastNumber = 0;
        }
    } catch (err: any) {
         if (err.code === 400 && err.message?.includes('Unable to parse range')) {
             console.warn(`Range '${range}' not found, likely sheet is empty or name is incorrect. Starting sequence from 1.`);
             lastNumber = 0;
         } else {
            console.error(`Error reading last Risk ID from sheet '${sheetName}': ${err.message}. Defaulting to start sequence from 1.`);
            lastNumber = 0;
         }
    }
    const nextNumber = lastNumber + 1;
    const paddedNumber = String(nextNumber).padStart(3, '0');
    return `${prefix}-${paddedNumber}`;
}

// --- Helper: Format potential array values into a single string ---
const formatPotentialArray = (value: string | string[] | undefined | null, fallback: string = 'TBD'): string => {
    if (Array.isArray(value)) {
        return value.join('; ');
    }
    if (typeof value === 'string' && value.trim() !== '') {
        return value;
    }
     // Check if value is explicitly null or undefined, otherwise use fallback only if value is truly absent
    if (value === null || value === undefined) {
       return fallback;
    }
    // Handle cases like empty string ('') which shouldn't become 'TBD'
    return String(value); // Convert potential numbers (like 0) or empty strings back to string
};

// --- POST Handler (Add Risk) ---
export async function POST(request: NextRequest) {
    console.log("--- Add Risk API Route Start ---");
    // 1. Check Config
    if (!GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || !GOOGLE_SHEET_ID) {
        console.error("!!! Add API Error: Sheets credentials or ID missing.");
        return NextResponse.json({ message: "Server configuration error: Google Sheets access details missing." }, { status: 500 });
    }
    console.log("Add API: Environment Variables Check Passed.");

    // 2. Parse Confirmed Data from Request
    let confirmedRiskData: Partial<RiskRegisterItem>;
    try {
        console.log("Parsing request body for confirmed risk data...");
        confirmedRiskData = await request.json();
        if (!confirmedRiskData || typeof confirmedRiskData !== 'object' || !confirmedRiskData.riskDescription) {
             console.error("Validation Error: Confirmed risk data is missing or invalid.", confirmedRiskData);
             return NextResponse.json({ message: "Confirmed risk data is incomplete (description missing)." }, { status: 400 });
        }
        console.log("Received confirmed data:", confirmedRiskData);
    } catch (e) {
        console.error("Error parsing request body (Add API):", e);
        return NextResponse.json({ message: "Invalid request body for adding risk." }, { status: 400 });
    }

    try {
        // 3. Initialize Sheets Client
        console.log("Initializing Sheets Client (Add API)...");
        const sheets = await getSheetsClient();

        // 4. Generate Next Risk ID
        console.log("Generating next Risk ID...");
        const nextId = await getNextRiskId(sheets, GOOGLE_SHEET_ID!, RISK_REGISTER_SHEET_NAME, RISK_ID_PREFIX);
        console.log(`Generated Risk ID: ${nextId}`);

        // 5. Prepare Final Row Data
        console.log("Preparing final row data for sheet...");
        const today = new Date().toISOString().split('T')[0];

        const finalRowData = [
            /* A */ nextId,
            /* B */ confirmedRiskData.riskDescription ?? 'N/A',
            /* C */ formatPotentialArray(confirmedRiskData.systemFocus, 'TBD'),
            /* D */ formatPotentialArray(confirmedRiskData.likelyCauses, 'TBD'),
            /* E */ formatPotentialArray(confirmedRiskData.potentialImpactConsequence, 'TBD'),
            /* F */ formatPotentialArray(confirmedRiskData.likelihood, 'Medium'),
            /* G */ formatPotentialArray(confirmedRiskData.severityImpactLevel, 'Medium'),
            /* H */ formatPotentialArray(confirmedRiskData.riskLevelScore, 'Medium'),
            /* I */ formatPotentialArray(confirmedRiskData.riskCategory, 'TBD'),
            /* J */ formatPotentialArray(confirmedRiskData.mitigationStrategiesActions, 'TBD'),
            /* K */ formatPotentialArray(confirmedRiskData.actionOwner, 'TBD'),
            /* L */ confirmedRiskData.dueDateString ?? 'TBD',
            /* M */ formatPotentialArray(confirmedRiskData.status, 'Open'),
            /* N */ formatPotentialArray(confirmedRiskData.residualRiskLevel ?? confirmedRiskData.riskLevelScore, 'Medium'),
            /* O */ today
        ];

        const expectedColumnCount = 15;
        while (finalRowData.length < expectedColumnCount) { finalRowData.push(''); }
        if (finalRowData.length > expectedColumnCount) { finalRowData.length = expectedColumnCount; }
        console.log("Final Row Data Prepared:", finalRowData);

        // 6. Append to Google Sheet
        console.log(`Appending data to sheet: '${RISK_REGISTER_SHEET_NAME}'...`);
        const appendRequest: sheets_v4.Params$Resource$Spreadsheets$Values$Append = {
            spreadsheetId: GOOGLE_SHEET_ID!,
            range: `${RISK_REGISTER_SHEET_NAME}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [finalRowData] },
        };

        const appendResult = await sheets.spreadsheets.values.append(appendRequest);
        console.log("Google Sheets API Append Result Status:", appendResult.status);

        if (appendResult.status !== 200) {
            // *** MODIFIED ERROR HANDLING ***
            console.error("!!! Google Sheets API Append Error:", appendResult.status, appendResult.statusText);
            // Log the data object if available, might contain more details sometimes
            if (appendResult.data) {
                console.error("Google Sheets API Error Data:", JSON.stringify(appendResult.data, null, 2));
            }
             // Use statusText if available, otherwise provide a generic message
            const detailedErrorMessage = appendResult.statusText || 'Failed to append row due to API error.';
            throw new Error(`Google Sheets API Error (${appendResult.status}): ${detailedErrorMessage}`);
            // *** END MODIFIED ERROR HANDLING ***
        }

        // 7. Return Success
        console.log("Risk successfully added to sheet.");
        return NextResponse.json({ message: "Risk added successfully to Google Sheet.", riskId: nextId }, { status: 200 });

    } catch (error: any) {
         console.error("!!! Error in Add Risk API POST handler:", error);
         if (error.code && error.errors) {
             console.error("Google API Error Details:", JSON.stringify(error.errors));
             const firstError = error.errors[0]?.message || error.message;
             return NextResponse.json({ message: `Google API Error: ${firstError}`, details: error.errors }, { status: Number(error.code) || 500 });
         }
         return NextResponse.json({ message: error.message || "An internal server error occurred while adding the risk." }, { status: 500 });
    } finally {
         console.log("--- Add Risk API Route End ---");
    }
}