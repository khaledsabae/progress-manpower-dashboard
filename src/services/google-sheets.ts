// src/services/google-sheets.ts
import { parse } from 'date-fns';

// --- Type Definitions ---

// Progress data from Sheet1
export interface ProgressSheetRow {
    id?: string | number;
    projects: string | null;
    buildingName: string | null;
    floorRoom: string | null;
    hvacPercentage: number | null;
    firefightingPercentage: number | null;
    fireAlarmPercentage: number | null;
    fireRemarks: string | null;
    hvacRemarks: string | null;
}

// Manpower data
export interface ManpowerSheetRow {
    dateString: string | null;
    timestamp: number | null;
    hvacManpower: number | null;
    firefightingManpower: number | null;
    fireAlarmManpower: number | null;
    totalManpower: number | null;
}

// Material status data
export interface MaterialStatusRow {
    system: string | null;
    itemDescription: string | null;
    buildingLocation: string | null;
    approvalStage: string | null;
    deliveryStatus: string | null;
    quantity: string | null;
    plannedDeliveryDateString: string | null;
    plannedTimestamp: number | null;
    actualDeliveryDateString: string | null;
    actualTimestamp: number | null;
    remarks: string | null;
    documentLink: string | null;
}

// Mechanical Plan data
export interface MechanicalPlanRow {
    areaBuilding: string | null;
    locationRoomLevel: string | null;
    mechanicalActivitySystem: string | null;
    originalDurationDays: number | null;
    currentProgressPercentage: number | null;
    keyPredecessorActivity: string | null;
    predecessorFinishDateString: string | null;
    predecessorFinishTimestamp: number | null;
    calculatedStartDateString: string | null;
    calculatedStartTimestamp: number | null;
    calculatedFinishDateString: string | null;
    calculatedFinishTimestamp: number | null;
    remarksJustification: string | null;
}

// HistoricalProgressRow Interface
export interface HistoricalProgressRow {
    snapshotDateString: string | null;
    snapshotTimestamp: number | null;
    dataSource?: string | null;
    specificLocation?: string | null;
    projects?: string | null;
    buildingName?: string | null;
    floorRoom?: string | null;
    firefightingPercentage?: number | null;
    fireAlarmPercentage?: number | null;
    fireRemarks?: string | null;
    hvacPercentage?: number | null;
    hvacRemarks?: string | null;
    areaBuilding?: string | null;
    mechanicalActivitySystem?: string | null;
    originalDurationDays?: number | null;
    currentProgressPercentage?: number | null;
    keyPredecessorActivity?: string | null;
    predecessorFinishDateString?: string | null;
    predecessorFinishTimestamp?: number | null;
    calculatedStartDateString?: string | null;
    calculatedStartTimestamp?: number | null;
    calculatedFinishDateString?: string | null;
    calculatedFinishTimestamp?: number | null;
    remarksJustification?: string | null;
    hvacManpower?: number | null;
    ffManpower?: number | null; // Assuming ffManpower is firefighting
    faManpower?: number | null; // Assuming faManpower is fire alarm
    totalManpower?: number | null;
}

// ---Risk Register Type Definition ---
export interface RiskRegisterItem { 
    riskId: string | null;
    riskDescription: string | null;
    systemFocus: string | null;
    likelyCauses: string | null;
    potentialImpactConsequence: string | null;
    likelihood: string | null; // Could be string (High, Medium, Low) or number
    severityImpactLevel: string | null; // Could be string or number
    riskLevelScore: string | null; // This will be the primary for color-coding & KPIs
    riskCategory: string | null;
    mitigationStrategiesActions: string | null;
    actionOwner: string | null;
    dueDateString: string | null; // Store as string from sheet
    dueDateTimestamp: number | null; // Parsed timestamp
    status: string | null;
    residualRiskLevel: string | null;
    lastUpdatedString: string | null; // Store as string from sheet
    lastUpdatedTimestamp: number | null; // Parsed timestamp
    // Optional: if the second 'Risk Level' column (P) has a distinct meaning
    // secondaryRiskLevel?: string | null;
}


// --- Constants ---
const GOOGLE_SHEET_ID = "1pEwohK-Lk6-8_xpUDVauEkxOCJ6H75XdFi8AFlxG_OU"; // Your Google Sheet ID
const BASE_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=`;

export const SHEET_NAMES = {
    PROGRESS: "Sheet1",
    MANPOWER: "Manpower",
    MATERIAL: "Material Status",
    PLAN: "Mechanical Plan",
    HISTORY: "Full Progress History",
    RISK_REGISTER: "RiskRegister" // <<<--- اسم الشيت الجديد
};


// --- Helper Functions ---
function parseCSV(csvText: string): { headers: string[], data: string[][] } {
    if (!csvText || typeof csvText !== 'string') { return { headers: [], data: [] }; }
    const lines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) { return { headers: [], data: [] }; }
    
    const parseLine = (line: string): string[] => {
        const fields: string[] = []; let currentField = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') { currentField += '"'; i++; } 
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) {
                fields.push(currentField); currentField = '';
            } else {
                currentField += char;
            }
        }
        fields.push(currentField); // Push the last field
        return fields.map(field => {
            const trimmedField = field.trim();
            // Handle fields that are entirely enclosed in quotes
            if (trimmedField.startsWith('"') && trimmedField.endsWith('"')) {
                return trimmedField.slice(1, -1).replace(/""/g, '"'); // Remove outer quotes and unescape double quotes
            }
            return trimmedField;
        });
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(h => h.toLowerCase().trim());
    const data: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const rowData = parseLine(lines[i]);
            // Ensure rowData has the same number of columns as headers, padding with empty strings if necessary
            while (rowData.length < headers.length) { rowData.push(''); }
            if (rowData.length > headers.length) { rowData.length = headers.length; } // Truncate if too long
            data.push(rowData);
        }
    }
    return { headers, data };
}

function parseNumberOrNull(value: string | undefined | null): number | null {
    if (value === null || value === undefined) return null;
    const trimmedVal = value.trim();
    if (trimmedVal === '' || trimmedVal === '-' || ['n/a', 'na', 'tbd'].some(kw => trimmedVal.toLowerCase() === kw)) return null;
    const numStr = trimmedVal.replace('%', '').replace('days', '').replace(/,/g, '').trim();
    if (numStr === '') return null;
    const num = parseFloat(numStr);
    return !isNaN(num) && isFinite(num) ? num : null;
}

function parseDateToTimestamp(dateString: string | undefined | null, formatStrings: string[] = ['MM/dd/yyyy', 'dd-MMM-yy', 'yyyy-MM-dd', 'M/d/yy', 'dd/MM/yyyy', 'M/dd/yy HH:mm:ss']): number | null {
    if (dateString === null || dateString === undefined) return null;
    let trimmedDateString = dateString.trim();
    
    // Handle common non-date placeholders
    if (!trimmedDateString || trimmedDateString === '.' || trimmedDateString === '-' || ['na', 'n/a', 'pending', 'tbd', 'asap', 'waiting'].some(kw => trimmedDateString.toLowerCase().includes(kw))) {
        return null;
    }

    // Handle "Mid-Mon-YY" or "Mid-Mon-YYYY" like "Mid-Apr-24"
    if (trimmedDateString.toLowerCase().startsWith('mid-')) {
        const midMonthMatch = trimmedDateString.match(/^Mid-?(\w{3})-?(\d{2}|\d{4})$/i);
        if (midMonthMatch) {
            const month = midMonthMatch[1]; let year = midMonthMatch[2];
            if (year.length === 2) { year = `20${year}`; }
            const potentialDateString = `15-${month}-${year}`;
            try {
                const parsedDate = parse(potentialDateString, 'dd-MMM-yyyy', new Date());
                if (!isNaN(parsedDate.getTime())) { return parsedDate.getTime(); }
            } catch (e) { /* Fall through to general parsing */ }
        }
    }
    
    const baseDate = new Date(); // For parsing, provides context if year is ambiguous (e.g. 'M/d')

    for (const formatStr of formatStrings) {
        try {
            const parsedDate = parse(trimmedDateString, formatStr, baseDate);
            if (!isNaN(parsedDate.getTime())) {
                // Basic validation for sensible year range, e.g., 1970-2100
                const year = parsedDate.getFullYear();
                if (year >= 1970 && year <= 2100) {
                    return parsedDate.getTime();
                }
            }
        } catch (e) { /* Ignore and try next format */ }
    }
    // console.warn(`[parseDateToTimestamp] Failed to parse date: "${trimmedDateString}" with any provided format.`);
    return null;
}


const getHeaderIndex = (headerMap: { [key: string]: number }, possibleHeaders: string[], sheetName: string, isCritical: boolean = false): number => {
    for (const h of possibleHeaders) {
        const lowerH = h.toLowerCase().trim();
        if (headerMap[lowerH] !== undefined) {
            return headerMap[lowerH];
        }
    }
    const errorMessage = `Header not found for: [${possibleHeaders.join(' or ')}] in sheet "${sheetName}". Available headers: [${Object.keys(headerMap).join(', ')}]`;
    if (isCritical) {
        console.error(`[CRITICAL] ${errorMessage}`);
    } else {
        // console.warn(`[WARNING] ${errorMessage}`); // Keep commented unless debugging
    }
    return -1;
};


// --- Data Fetching Functions ---

export async function getProgressSheetData(sheetName: string): Promise<ProgressSheetRow[]> {
    const cacheBuster = `&_cb=${new Date().getTime()}`;
    const csvUrl = `${BASE_URL}${encodeURIComponent(sheetName)}${cacheBuster}`;
    try {
        const response = await fetch(csvUrl, { cache: 'no-store' });
        const csvText = await response.text();
        if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}. URL: ${csvUrl}`); }
        if (!csvText || csvText.trim() === '' || csvText.toLowerCase().includes('<html')) { throw new Error(`Empty or invalid CSV response from URL: ${csvUrl}`); }
        let parsedResult; try { parsedResult = parseCSV(csvText); } catch (e: any) { throw new Error(`Failed to parse CSV from sheet "${sheetName}": ${e.message}`); }
        if (!parsedResult?.headers || !parsedResult.data) { throw new Error(`Invalid parsed CSV structure from sheet "${sheetName}".`); }

        const { headers, data: rows } = parsedResult;
        const headerMap: { [key: string]: number } = {}; headers.forEach((h, i) => { headerMap[h] = i; });

        const idIdx = getHeaderIndex(headerMap, ['id'], sheetName);
        const pIdx = getHeaderIndex(headerMap, ['projects', 'project'], sheetName, true);
        const bIdx = getHeaderIndex(headerMap, ['building name', 'building'], sheetName, true);
        const fIdx = getHeaderIndex(headerMap, ['floor/room', 'floor', 'room'], sheetName);
        const hPIdx = getHeaderIndex(headerMap, ['hvac (%)', 'hvac'], sheetName);
        const ffIdx = getHeaderIndex(headerMap, ['firefighting (%)', 'ff (%)', 'ff'], sheetName);
        const faIdx = getHeaderIndex(headerMap, ['fire alarm (%)', 'fa (%)', 'fa'], sheetName);
        const hrIdx = getHeaderIndex(headerMap, ['hvac remarks', 'hvac remark'], sheetName);
        const frIdx = getHeaderIndex(headerMap, ['fire remarks', 'fire remark', 'ff remarks', 'fa remarks'], sheetName);

        if (pIdx === -1 || bIdx === -1) {
            console.error(`[getProgressSheetData] Critical headers missing in sheet "${sheetName}". Cannot process.`);
            return [];
        }

        const pData: ProgressSheetRow[] = rows.map((v, i) => {
            const maxIdxNeeded = Math.max(pIdx, bIdx, fIdx, hPIdx, ffIdx, faIdx, hrIdx, frIdx, idIdx);
            if (maxIdxNeeded > -1 && v.length <= maxIdxNeeded && !v.slice(0, maxIdxNeeded + 1).some(cell => cell && cell.trim() !== '')) { return null; }
            
            const rowData: ProgressSheetRow = {
                id: idIdx !== -1 && v[idIdx] ? v[idIdx] : `progress-${i + 1}`,
                projects: pIdx !== -1 ? v[pIdx]?.trim() || null : null,
                buildingName: bIdx !== -1 ? v[bIdx]?.trim() || null : null,
                floorRoom: fIdx !== -1 ? v[fIdx]?.trim() || null : null,
                hvacPercentage: parseNumberOrNull(hPIdx !== -1 ? v[hPIdx] : null),
                firefightingPercentage: parseNumberOrNull(ffIdx !== -1 ? v[ffIdx] : null),
                fireAlarmPercentage: parseNumberOrNull(faIdx !== -1 ? v[faIdx] : null),
                hvacRemarks: hrIdx !== -1 ? v[hrIdx]?.trim() || null : null,
                fireRemarks: frIdx !== -1 ? v[frIdx]?.trim() || null : null,
            };
            return (rowData.projects || rowData.buildingName) ? rowData : null;
        }).filter((r): r is ProgressSheetRow => r !== null);
        return pData;
    } catch (error) {
        console.error(`[getProgressSheetData] Error fetching/processing sheet "${sheetName}":`, error);
        throw new Error(`Failed to process Progress data from sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
    }
}


export async function getManpowerSheetData(sheetName: string): Promise<ManpowerSheetRow[]> {
    const cacheBuster = `&_cb=${new Date().getTime()}`;
    const csvUrl = `${BASE_URL}${encodeURIComponent(sheetName)}${cacheBuster}`;
    try {
        const response = await fetch(csvUrl, { cache: 'no-store' });
        const csvText = await response.text();
        if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}. URL: ${csvUrl}`); }
        if (!csvText || csvText.trim() === '' || csvText.toLowerCase().includes('<html')) { throw new Error(`Empty or invalid CSV response from URL: ${csvUrl}`); }
        let parsedResult; try { parsedResult = parseCSV(csvText); } catch (e: any) { throw new Error(`Failed to parse CSV from sheet "${sheetName}": ${e.message}`); }
        if (!parsedResult?.headers || !parsedResult.data) { throw new Error(`Invalid parsed CSV structure from sheet "${sheetName}".`); }

        const { headers, data: rows } = parsedResult;
        const headerMap: { [key: string]: number } = {}; headers.forEach((h, i) => { headerMap[h] = i; });

        const dIdx = getHeaderIndex(headerMap, ['date', 'day', 'التاريخ', 'اليوم'], sheetName, true);
        const hIdx = getHeaderIndex(headerMap, ['hvac manpower', 'hvac'], sheetName);
        const ffIdx = getHeaderIndex(headerMap, ['firefighting manpower', 'ff', 'firefighting'], sheetName);
        const faIdx = getHeaderIndex(headerMap, ['fire alarm manpower', 'fa', 'fire alarm'], sheetName);
        const tIdx = getHeaderIndex(headerMap, ['total manpower', 'total'], sheetName);

        if (dIdx === -1) {
            console.error(`[getManpowerSheetData] Critical header 'Date' not found in sheet "${sheetName}".`);
            return [];
        }

        const manpowerDateFormats = ['MM/dd/yyyy', 'M/d/yyyy', 'dd-MMM-yy', 'yyyy-MM-dd', 'dd/MM/yyyy'];

        const pData: ManpowerSheetRow[] = rows.map((v) => {
            const maxIdxNeeded = Math.max(dIdx, hIdx, ffIdx, faIdx, tIdx);
             if (maxIdxNeeded > -1 && v.length <= maxIdxNeeded && !v.slice(0, maxIdxNeeded + 1).some(cell => cell && cell.trim() !== '')) { return null; }

            const dS = v[dIdx] || null;
            const tS = parseDateToTimestamp(dS, manpowerDateFormats);
            if (tS === null && dS && dS.trim() !== '') { 
                 // console.warn(`[getManpowerSheetData] Could not parse date "${dS}" for manpower. Skipping row.`);
                 return null; 
            }
            if (tS === null) return null; // Skip if no valid date

            const rowData: ManpowerSheetRow = {
                dateString: dS, timestamp: tS,
                hvacManpower: parseNumberOrNull(hIdx !== -1 ? v[hIdx] : null),
                firefightingManpower: parseNumberOrNull(ffIdx !== -1 ? v[ffIdx] : null),
                fireAlarmManpower: parseNumberOrNull(faIdx !== -1 ? v[faIdx] : null),
                totalManpower: parseNumberOrNull(tIdx !== -1 ? v[tIdx] : null),
            };
            return rowData;
        }).filter((r): r is ManpowerSheetRow => r !== null);
        return pData;
    } catch (error) {
        console.error(`[getManpowerSheetData] Error fetching/processing sheet "${sheetName}":`, error);
        throw new Error(`Failed to process Manpower data from sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getMaterialStatusData(sheetName: string): Promise<MaterialStatusRow[]> {
    const cacheBuster = `&_cb=${new Date().getTime()}`;
    const csvUrl = `${BASE_URL}${encodeURIComponent(sheetName)}${cacheBuster}`;
    try {
        const response = await fetch(csvUrl, { cache: 'no-store' });
        const csvText = await response.text();
        // console.log("RAW CSV DATA --- Material Status --- STARTS BELOW:");
        // console.log(csvText.substring(0, 2000));
        // console.log("RAW CSV DATA --- Material Status --- ENDS ABOVE.");

        if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}. URL: ${csvUrl}`); }
        if (!csvText || csvText.trim() === '' || csvText.toLowerCase().includes('<html')) { throw new Error(`Empty or invalid CSV response from URL: ${csvUrl}`); }
        let parsedResult; try { parsedResult = parseCSV(csvText); } catch (e: any) { throw new Error(`Failed to parse CSV from sheet "${sheetName}": ${e.message}`); }
        if (!parsedResult?.headers || !parsedResult.data) { throw new Error(`Invalid parsed CSV structure from sheet "${sheetName}".`); }

        const { headers, data: rows } = parsedResult;
        const headerMap: { [key: string]: number } = {}; headers.forEach((h, i) => { headerMap[h] = i; });

        const systemIdx = getHeaderIndex(headerMap, ['system'], sheetName);
        const itemDescIdx = getHeaderIndex(headerMap, ['item description'], sheetName, true);
        const locationIdx = getHeaderIndex(headerMap, ['building location', 'location'], sheetName);
        const approvalIdx = getHeaderIndex(headerMap, ['approval stage', 'approval'], sheetName);
        const statusIdx = getHeaderIndex(headerMap, ['delivery status', 'status'], sheetName);
        const quantityIdx = getHeaderIndex(headerMap, ['quantity (approved drawings)', 'quantity', 'qty'], sheetName);
        const plannedDateIdx = getHeaderIndex(headerMap, ['planned delivery date', 'planned date', 'planned'], sheetName);
        const actualDateIdx = getHeaderIndex(headerMap, ['actual delivery date', 'actual date', 'actual'], sheetName);
        const remarksIdx = getHeaderIndex(headerMap, ['remarks'], sheetName);
        const docLinkIdx = getHeaderIndex(headerMap, ['document link', 'doc link', 'link'], sheetName);

        if (itemDescIdx === -1) {
            console.error(`[getMaterialStatusData] Critical header 'Item Description' not found in sheet "${sheetName}".`);
            return [];
        }

        const materialDateFormats = ['dd-MMM-yy', 'dd-MMM-yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd/MM/yyyy', 'M/d/yy'];

        const pData: MaterialStatusRow[] = rows.map((values) => {
            const maxIdxNeeded = Math.max(systemIdx, itemDescIdx, locationIdx, approvalIdx, statusIdx, quantityIdx, plannedDateIdx, actualDateIdx, remarksIdx, docLinkIdx);
            if (maxIdxNeeded > -1 && values.length <= maxIdxNeeded && !values.slice(0, maxIdxNeeded + 1).some(cell => cell && cell.trim() !== '')) { return null; }
            
            const plannedDateStr = plannedDateIdx !== -1 ? values[plannedDateIdx] : null;
            const actualDateStr = actualDateIdx !== -1 ? values[actualDateIdx] : null;
            
            const rowData: MaterialStatusRow = {
                system: systemIdx !== -1 ? values[systemIdx]?.trim() || null : null,
                itemDescription: itemDescIdx !== -1 ? values[itemDescIdx]?.trim() || null : null,
                buildingLocation: locationIdx !== -1 ? values[locationIdx]?.trim() || null : null,
                approvalStage: approvalIdx !== -1 ? values[approvalIdx]?.trim() || null : null,
                deliveryStatus: statusIdx !== -1 ? values[statusIdx]?.trim() || null : null,
                quantity: quantityIdx !== -1 ? values[quantityIdx]?.trim() || null : null, // Kept as string, can be parsed in component if needed
                plannedDeliveryDateString: plannedDateStr,
                plannedTimestamp: parseDateToTimestamp(plannedDateStr, materialDateFormats),
                actualDeliveryDateString: actualDateStr,
                actualTimestamp: parseDateToTimestamp(actualDateStr, materialDateFormats),
                remarks: remarksIdx !== -1 ? values[remarksIdx]?.trim() || null : null,
                documentLink: docLinkIdx !== -1 ? values[docLinkIdx]?.trim() || null : null,
            };
            return rowData.itemDescription ? rowData : null;
        }).filter((row): row is MaterialStatusRow => row !== null);
        return pData;
    } catch (error) {
        console.error(`[getMaterialStatusData] Error fetching/processing sheet "${sheetName}":`, error);
        throw new Error(`Failed to process Material Status data from sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getHistoricalProgressData(sheetName: string): Promise<HistoricalProgressRow[]> {
    const cacheBuster = `&_cb=${new Date().getTime()}`;
    const csvUrl = `${BASE_URL}${encodeURIComponent(sheetName)}${cacheBuster}`;
    try {
        const response = await fetch(csvUrl, { cache: 'no-store' });
        const csvText = await response.text();
        if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}. URL: ${csvUrl}`); }
        if (!csvText || csvText.trim() === '' || csvText.toLowerCase().includes('<html')) { throw new Error(`Empty or invalid CSV response from URL: ${csvUrl}`); }
        let parsedResult; try { parsedResult = parseCSV(csvText); } catch (e: any) { throw new Error(`Failed to parse CSV from sheet "${sheetName}": ${e.message}`); }
        if (!parsedResult?.headers || !parsedResult.data) { throw new Error(`Invalid parsed CSV structure from sheet "${sheetName}".`); }

        const { headers, data: rows } = parsedResult;
        const headerMap: { [key: string]: number } = {}; headers.forEach((h, i) => { headerMap[h] = i; });

        const dateIdx = getHeaderIndex(headerMap, ['snapshotdate', 'snapshot date'], sheetName, true);
        const dataSourceIdx = getHeaderIndex(headerMap, ['datasource', 'data source'], sheetName, false);
        const pIdx = getHeaderIndex(headerMap, ['projects'], sheetName);
        const bIdx = getHeaderIndex(headerMap, ['building name', 'building'], sheetName);
        const fIdx = getHeaderIndex(headerMap, ['floor/room', 'floor', 'room'], sheetName);
        const ffPIdx = getHeaderIndex(headerMap, ['firefighting (%)', 'ff (%)', 'firefighting'], sheetName);
        const faPIdx = getHeaderIndex(headerMap, ['fire alarm (%)', 'fa (%)', 'fire alarm'], sheetName);
        const frIdx = getHeaderIndex(headerMap, ['fire remarks'], sheetName);
        const hPIdx = getHeaderIndex(headerMap, ['hvac (%)', 'hvac'], sheetName);
        const hrIdx = getHeaderIndex(headerMap, ['hvac remarks'], sheetName);
        const areaBuildingIdx = getHeaderIndex(headerMap, ['area/building', 'areabuilding'], sheetName);
        const locationRoomLevelIdx = getHeaderIndex(headerMap, ['location (room/level)'], sheetName);
        const activityIdx = getHeaderIndex(headerMap, ['mechanical activity (system)', 'activity'], sheetName);
        const durationIdx = getHeaderIndex(headerMap, ['original duration (days)', 'duration (days)', 'duration'], sheetName);
        const progressIdx = getHeaderIndex(headerMap, ['current progress %', '% progress', 'progress %'], sheetName);
        const predecessorIdx = getHeaderIndex(headerMap, ['key predecessor activity', 'predecessor'], sheetName);
        const predFinishDateIdx = getHeaderIndex(headerMap, ['predecessor finish date', 'pred. finish'], sheetName);
        const calcStartDateIdx = getHeaderIndex(headerMap, ['calculated mech. start date', 'calc. start', 'start date'], sheetName);
        const calcFinishDateIdx = getHeaderIndex(headerMap, ['calculated mech. finish date', 'calc. finish', 'finish date'], sheetName);
        const remarksJustificationIdx = getHeaderIndex(headerMap, ['remarks / justification', 'remarks'], sheetName);
        const hMIdx = getHeaderIndex(headerMap, ['hvac manpower'], sheetName);
        const ffMIdx = getHeaderIndex(headerMap, ['firefighting manpower', 'ff manpower'], sheetName);
        const faMIdx = getHeaderIndex(headerMap, ['fire alarm manpower', 'fa manpower'], sheetName);
        const tMIdx = getHeaderIndex(headerMap, ['total manpower'], sheetName);

        if (dateIdx === -1) { console.error(`[getHistoricalProgressData] Critical header 'SnapshotDate' not found in sheet "${sheetName}".`); return []; }
        if (bIdx === -1 && areaBuildingIdx === -1) { /* console.warn(`[getHistoricalProgressData] Warning: Neither 'Building Name' nor 'Area/Building' found in sheet "${sheetName}".`); */ }
        if (fIdx === -1 && locationRoomLevelIdx === -1) { /* console.warn(`[getHistoricalProgressData] Warning: Neither 'Floor/Room' nor 'Location (Room/Level)' found in sheet "${sheetName}". Specific locations might be missing.`); */ }

        const historyDateFormats = ['yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy'];
        const planDateFormats = ['MM/dd/yyyy', 'M/d/yyyy', 'yyyy-MM-dd', 'dd-MMM-yy', 'dd/MM/yyyy'];

        const pData: HistoricalProgressRow[] = rows.map((v) => {
            const allIndices = [dateIdx, dataSourceIdx, pIdx, bIdx, fIdx, ffPIdx, faPIdx, frIdx, hPIdx, hrIdx, areaBuildingIdx, locationRoomLevelIdx, activityIdx, durationIdx, progressIdx, predecessorIdx, predFinishDateIdx, calcStartDateIdx, calcFinishDateIdx, remarksJustificationIdx, hMIdx, ffMIdx, faMIdx, tMIdx];
            const maxIdxNeeded = Math.max(...allIndices.filter(idx => idx !== -1 && idx !== undefined));
            if (maxIdxNeeded > -1 && v.length <= maxIdxNeeded && !v.slice(0, maxIdxNeeded + 1).some(cell => cell && cell.trim() !== '')) { return null; }


            const dateStr = dateIdx !== -1 ? v[dateIdx] : null;
            const timestamp = parseDateToTimestamp(dateStr, historyDateFormats);
            if (timestamp === null && dateStr && dateStr.trim() !== '') { return null; }
            if (timestamp === null) return null;


            let specificLocationValue: string | null = null;
            if (locationRoomLevelIdx !== -1 && v[locationRoomLevelIdx]?.trim()) {
                specificLocationValue = v[locationRoomLevelIdx].trim();
            } else if (fIdx !== -1 && v[fIdx]?.trim()) {
                specificLocationValue = v[fIdx].trim();
            }

            const rowData: HistoricalProgressRow = {
                snapshotDateString: dateStr,
                snapshotTimestamp: timestamp,
                dataSource: dataSourceIdx !== -1 ? v[dataSourceIdx]?.trim() || null : undefined,
                specificLocation: specificLocationValue,
                projects: pIdx !== -1 ? v[pIdx]?.trim() || null : undefined,
                buildingName: bIdx !== -1 ? v[bIdx]?.trim() || null : undefined,
                floorRoom: fIdx !== -1 ? v[fIdx]?.trim() || null : undefined,
                firefightingPercentage: parseNumberOrNull(ffPIdx !== -1 ? v[ffPIdx] : undefined),
                fireAlarmPercentage: parseNumberOrNull(faPIdx !== -1 ? v[faPIdx] : undefined),
                fireRemarks: frIdx !== -1 ? v[frIdx]?.trim() || null : undefined,
                hvacPercentage: parseNumberOrNull(hPIdx !== -1 ? v[hPIdx] : undefined),
                hvacRemarks: hrIdx !== -1 ? v[hrIdx]?.trim() || null : undefined,
                areaBuilding: areaBuildingIdx !== -1 ? v[areaBuildingIdx]?.trim() || null : undefined,
                mechanicalActivitySystem: activityIdx !== -1 ? v[activityIdx]?.trim() || null : undefined,
                originalDurationDays: parseNumberOrNull(durationIdx !== -1 ? v[durationIdx] : undefined),
                currentProgressPercentage: parseNumberOrNull(progressIdx !== -1 ? v[progressIdx] : undefined),
                keyPredecessorActivity: predecessorIdx !== -1 ? v[predecessorIdx]?.trim() || null : undefined,
                predecessorFinishDateString: predFinishDateIdx !== -1 ? v[predFinishDateIdx] : undefined,
                predecessorFinishTimestamp: parseDateToTimestamp(predFinishDateIdx !== -1 ? v[predFinishDateIdx] : undefined, planDateFormats),
                calculatedStartDateString: calcStartDateIdx !== -1 ? v[calcStartDateIdx] : undefined,
                calculatedStartTimestamp: parseDateToTimestamp(calcStartDateIdx !== -1 ? v[calcStartDateIdx] : undefined, planDateFormats),
                calculatedFinishDateString: calcFinishDateIdx !== -1 ? v[calcFinishDateIdx] : undefined,
                calculatedFinishTimestamp: parseDateToTimestamp(calcFinishDateIdx !== -1 ? v[calcFinishDateIdx] : undefined, planDateFormats),
                remarksJustification: remarksJustificationIdx !== -1 ? v[remarksJustificationIdx]?.trim() || null : undefined,
                hvacManpower: parseNumberOrNull(hMIdx !== -1 ? v[hMIdx] : undefined),
                ffManpower: parseNumberOrNull(ffMIdx !== -1 ? v[ffMIdx] : undefined),
                faManpower: parseNumberOrNull(faMIdx !== -1 ? v[faMIdx] : undefined),
                totalManpower: parseNumberOrNull(tMIdx !== -1 ? v[tMIdx] : undefined),
            };
            if (!rowData.projects && !rowData.buildingName && !rowData.areaBuilding && !rowData.mechanicalActivitySystem) {
                 // If no primary identifiers, consider the row invalid for history unless it has some progress data
                if (rowData.hvacPercentage == null && rowData.firefightingPercentage == null && rowData.fireAlarmPercentage == null && rowData.currentProgressPercentage == null) {
                    return null;
                }
            }
            return rowData;
        }).filter((r): r is HistoricalProgressRow => r !== null);
        // console.log(`[getHistoricalProgressData] Successfully processed ${pData.length} rows from sheet "${sheetName}".`);
        return pData;
    } catch (error) {
        console.error(`[getHistoricalProgressData] Error fetching/processing sheet "${sheetName}":`, error);
        throw new Error(`Failed to process Historical Progress data from sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
    }
}


export async function getMechanicalPlanData(sheetName: string): Promise<MechanicalPlanRow[]> {
    if (!sheetName) { throw new Error("Sheet name for Mechanical Plan is missing."); }
    const cacheBuster = `&_cb=${new Date().getTime()}`;
    const csvUrl = `${BASE_URL}${encodeURIComponent(sheetName)}${cacheBuster}`;
    try {
        const response = await fetch(csvUrl, { cache: 'no-store' });
        const csvText = await response.text();
        // console.log("[getMechanicalPlanData DEBUG] For sheet:", sheetName, "URL was:", csvUrl, "RAW CSV TEXT (first 500 chars):", csvText.substring(0, 500));
        if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}. URL: ${csvUrl}`); }
        if (!csvText || csvText.trim() === '' || csvText.toLowerCase().includes('<html') || csvText.toLowerCase().includes('error')) { throw new Error(`Google Sheets returned empty or error response for URL: ${csvUrl}. Response: ${csvText.substring(0,300)}`); }

        let parsedResult; try { parsedResult = parseCSV(csvText); } catch (parseError: any) { throw new Error(`Failed to parse CSV data from sheet "${sheetName}": ${parseError.message}`); }
        if (!parsedResult?.headers || !parsedResult.data) { throw new Error(`Invalid data structure after parsing CSV from sheet "${sheetName}".`); }

        const { headers, data: rows } = parsedResult;
        const headerMap: { [key: string]: number } = {}; headers.forEach((h, i) => { headerMap[h] = i; });

        const areaBuildingIdx = getHeaderIndex(headerMap, ['area/building', 'areabuilding'], sheetName, true);
        const locationIdx = getHeaderIndex(headerMap, ['location (room/level)', 'location', 'room/level'], sheetName);
        const activityIdx = getHeaderIndex(headerMap, ['mechanical activity (system)', 'activity'], sheetName, true);
        const durationIdx = getHeaderIndex(headerMap, ['original duration (days)', 'duration (days)', 'duration'], sheetName);
        const progressIdx = getHeaderIndex(headerMap, ['current progress %', '% progress', 'progress %'], sheetName);
        const predecessorIdx = getHeaderIndex(headerMap, ['key predecessor activity', 'predecessor'], sheetName);
        const predFinishDateIdx = getHeaderIndex(headerMap, ['predecessor finish date', 'pred. finish'], sheetName);
        const calcStartDateIdx = getHeaderIndex(headerMap, ['calculated mech. start date', 'calc. start', 'start date'], sheetName);
        const calcFinishDateIdx = getHeaderIndex(headerMap, ['calculated mech. finish date', 'calc. finish', 'finish date'], sheetName);
        const remarksIdx = getHeaderIndex(headerMap, ['remarks / justification', 'remarks'], sheetName);

        if (areaBuildingIdx === -1 || activityIdx === -1) {
            console.error(`[getMechanicalPlanData] Critical Headers 'Area/Building' or 'Mechanical Activity (System)' not found in sheet "${sheetName}". Please verify sheet headers.`);
            return [];
        }
        if (locationIdx === -1) {
            // console.warn(`[getMechanicalPlanData] Optional header 'Location (Room/Level)' not found in sheet "${sheetName}". Location details might be missing.`);
        }

        const planDateFormats = ['MM/dd/yyyy', 'M/d/yyyy', 'yyyy-MM-dd', 'dd-MMM-yy', 'dd/MM/yyyy'];

        const processedData: MechanicalPlanRow[] = rows.map((values) => {
            const indices = [areaBuildingIdx, locationIdx, activityIdx, durationIdx, progressIdx, predecessorIdx, predFinishDateIdx, calcStartDateIdx, calcFinishDateIdx, remarksIdx];
            const maxIdxNeeded = Math.max(...indices.filter(idx => idx !== -1 && idx !== undefined));
             if (maxIdxNeeded > -1 && values.length <= maxIdxNeeded && !values.slice(0, maxIdxNeeded + 1).some(cell => cell && cell.trim() !== '')) { return null; }


            const predFinishStr = predFinishDateIdx !== -1 ? values[predFinishDateIdx] : null;
            const calcStartStr = calcStartDateIdx !== -1 ? values[calcStartDateIdx] : null;
            const calcFinishStr = calcFinishDateIdx !== -1 ? values[calcFinishDateIdx] : null;
            const progressStr = progressIdx !== -1 ? values[progressIdx] : null;
            const durationStr = durationIdx !== -1 ? values[durationIdx] : null;
            const locationStr = locationIdx !== -1 ? values[locationIdx] : null;

            const rowData: MechanicalPlanRow = {
                areaBuilding: areaBuildingIdx !== -1 ? values[areaBuildingIdx]?.trim() || null : null,
                locationRoomLevel: locationStr?.trim() || null,
                mechanicalActivitySystem: activityIdx !== -1 ? values[activityIdx]?.trim() || null : null,
                originalDurationDays: parseNumberOrNull(durationStr),
                currentProgressPercentage: parseNumberOrNull(progressStr),
                keyPredecessorActivity: predecessorIdx !== -1 ? values[predecessorIdx]?.trim() || null : null,
                predecessorFinishDateString: predFinishStr,
                predecessorFinishTimestamp: parseDateToTimestamp(predFinishStr, planDateFormats),
                calculatedStartDateString: calcStartStr,
                calculatedStartTimestamp: parseDateToTimestamp(calcStartStr, planDateFormats),
                calculatedFinishDateString: calcFinishStr,
                calculatedFinishTimestamp: parseDateToTimestamp(calcFinishStr, planDateFormats),
                remarksJustification: remarksIdx !== -1 ? values[remarksIdx]?.trim() || null : null,
            };
            return rowData.areaBuilding && rowData.mechanicalActivitySystem ? rowData : null;
        }).filter((row): row is MechanicalPlanRow => row !== null);
        // console.log(`[getMechanicalPlanData] Processed ${processedData.length} valid rows from sheet "${sheetName}".`);
        return processedData;
    } catch (error) {
        console.error(`[getMechanicalPlanData] Error processing sheet "${sheetName}":`, error);
        throw new Error(`Failed to process Mechanical Plan data from sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- NEW: Function to fetch Risk Register Data ---
export async function getRiskRegisterData(sheetName: string = SHEET_NAMES.RISK_REGISTER): Promise<RiskRegisterItem[]> {
    if (!sheetName) {
        console.error("[getRiskRegisterData] Sheet name for Risk Register is missing.");
        throw new Error("Sheet name for Risk Register is missing.");
    }
    const cacheBuster = `&_cb=${new Date().getTime()}`;
    const csvUrl = `${BASE_URL}${encodeURIComponent(sheetName)}${cacheBuster}`;

    try {
        const response = await fetch(csvUrl, { cache: 'no-store' });
        const csvText = await response.text();
        // console.log(`[getRiskRegisterData] RAW CSV for ${sheetName} (first 500 chars):`, csvText.substring(0, 500));

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}. URL: ${csvUrl}`);
        }
        if (!csvText || csvText.trim() === '' || csvText.toLowerCase().includes('<html') || csvText.toLowerCase().includes('error')) {
            throw new Error(`Google Sheets returned empty or error response for Risk Register URL: ${csvUrl}. Response: ${csvText.substring(0, 300)}`);
        }

        let parsedResult;
        try {
            parsedResult = parseCSV(csvText);
        } catch (parseError: any) {
            console.error(`[getRiskRegisterData] Failed to parse CSV data from sheet "${sheetName}":`, parseError);
            throw new Error(`Failed to parse CSV data from sheet "${sheetName}": ${parseError.message}`);
        }

        if (!parsedResult?.headers || !parsedResult.data) {
            throw new Error(`Invalid data structure after parsing CSV from Risk Register sheet "${sheetName}".`);
        }

        const { headers, data: rows } = parsedResult;
        const headerMap: { [key: string]: number } = {};
        headers.forEach((h, i) => { headerMap[h] = i; }); // h is already toLowerCase().trim() from parseCSV

        // Define indices based on your provided column names (from the image)
        const riskIdIdx = getHeaderIndex(headerMap, ['risk id'], sheetName, true);
        const riskDescIdx = getHeaderIndex(headerMap, ['risk description'], sheetName, true);
        const systemFocusIdx = getHeaderIndex(headerMap, ['system focus'], sheetName);
        const likelyCausesIdx = getHeaderIndex(headerMap, ['likely causes'], sheetName);
        const impactIdx = getHeaderIndex(headerMap, ['potential impact / consequence', 'potential impact'], sheetName);
        const likelihoodIdx = getHeaderIndex(headerMap, ['likelihood'], sheetName);
        const severityIdx = getHeaderIndex(headerMap, ['severity / impact level', 'severity'], sheetName);
        const riskLevelScoreIdx = getHeaderIndex(headerMap, ['risk level / score', 'risk level score', 'risk score'], sheetName, true); // Critical for KPIs
        const riskCategoryIdx = getHeaderIndex(headerMap, ['risk category'], sheetName);
        const mitigationIdx = getHeaderIndex(headerMap, ['mitigation strategies / actions', 'mitigation actions'], sheetName);
        const ownerIdx = getHeaderIndex(headerMap, ['action owner'], sheetName);
        const dueDateIdx = getHeaderIndex(headerMap, ['due date'], sheetName);
        const statusIdx = getHeaderIndex(headerMap, ['status'], sheetName);
        const residualRiskIdx = getHeaderIndex(headerMap, ['residual risk level'], sheetName);
        const lastUpdatedIdx = getHeaderIndex(headerMap, ['last updated'], sheetName);
        // const secondaryRiskLevelIdx = getHeaderIndex(headerMap, ['risk level'], sheetName); // For column P if needed

        if (riskIdIdx === -1 || riskDescIdx === -1 || riskLevelScoreIdx === -1) {
            console.error(`[getRiskRegisterData] Critical headers (Risk ID, Description, or Level/Score) not found in sheet "${sheetName}". Please verify sheet headers.`);
            return [];
        }
        
        const riskDateFormats = ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd-MMM-yy', 'M/d/yy', 'MM/dd/yyyy HH:mm:ss', 'dd/MM/yyyy HH:mm:ss'];


        const processedData: RiskRegisterItem[] = rows.map((v, i) => {
            const allMappedIndices = [riskIdIdx, riskDescIdx, systemFocusIdx, likelyCausesIdx, impactIdx, likelihoodIdx, severityIdx, riskLevelScoreIdx, riskCategoryIdx, mitigationIdx, ownerIdx, dueDateIdx, statusIdx, residualRiskIdx, lastUpdatedIdx];
            const maxIdxNeeded = Math.max(...allMappedIndices.filter(idx => idx !== -1 && idx !== undefined));
            
            // Skip empty rows more reliably
            if (v.every(cell => !cell || cell.trim() === '')) {
                return null;
            }
            // Also check if critical fields are missing or if row is shorter than expected for critical fields
            if ( (riskIdIdx !== -1 && (!v[riskIdIdx] || v[riskIdIdx].trim() === '')) || 
                 (riskDescIdx !== -1 && (!v[riskDescIdx] || v[riskDescIdx].trim() === '')) ||
                 (maxIdxNeeded > -1 && v.length <= maxIdxNeeded && !v.slice(0, maxIdxNeeded + 1).some(cell => cell && cell.trim() !== ''))
               ) {
                // console.warn(`[getRiskRegisterData] Skipping row ${i+1} due to missing critical data or insufficient columns.`);
                return null;
            }


            const dueDateStr = dueDateIdx !== -1 ? v[dueDateIdx] : null;
            const lastUpdatedStr = lastUpdatedIdx !== -1 ? v[lastUpdatedIdx] : null;

            const rowData: RiskRegisterItem = {
                riskId: riskIdIdx !== -1 ? v[riskIdIdx]?.trim() || `RISK-${i + Date.now()}` : `RISK-${i + Date.now()}`, // Fallback ID
                riskDescription: riskDescIdx !== -1 ? v[riskDescIdx]?.trim() || null : null,
                systemFocus: systemFocusIdx !== -1 ? v[systemFocusIdx]?.trim() || null : null,
                likelyCauses: likelyCausesIdx !== -1 ? v[likelyCausesIdx]?.trim() || null : null,
                potentialImpactConsequence: impactIdx !== -1 ? v[impactIdx]?.trim() || null : null,
                likelihood: likelihoodIdx !== -1 ? v[likelihoodIdx]?.trim() || null : null,
                severityImpactLevel: severityIdx !== -1 ? v[severityIdx]?.trim() || null : null,
                riskLevelScore: riskLevelScoreIdx !== -1 ? v[riskLevelScoreIdx]?.trim() || null : null,
                riskCategory: riskCategoryIdx !== -1 ? v[riskCategoryIdx]?.trim() || null : null,
                mitigationStrategiesActions: mitigationIdx !== -1 ? v[mitigationIdx]?.trim() || null : null,
                actionOwner: ownerIdx !== -1 ? v[ownerIdx]?.trim() || null : null,
                dueDateString: dueDateStr,
                dueDateTimestamp: parseDateToTimestamp(dueDateStr, riskDateFormats),
                status: statusIdx !== -1 ? v[statusIdx]?.trim() || null : null,
                residualRiskLevel: residualRiskIdx !== -1 ? v[residualRiskIdx]?.trim() || null : null,
                lastUpdatedString: lastUpdatedStr,
                lastUpdatedTimestamp: parseDateToTimestamp(lastUpdatedStr, riskDateFormats),
                // secondaryRiskLevel: secondaryRiskLevelIdx !== -1 ? v[secondaryRiskLevelIdx]?.trim() || null : undefined,
            };
            // Ensure at least riskId and riskDescription are present to consider it a valid row
            if (!rowData.riskId || !rowData.riskDescription) {
                // console.warn(`[getRiskRegisterData] Row ${i+2} in sheet "${sheetName}" skipped due to missing Risk ID or Description.`);
                return null;
            }
            return rowData;
        }).filter((row): row is RiskRegisterItem => row !== null);
        
        // console.log(`[getRiskRegisterData] Processed ${processedData.length} valid risk items from sheet "${sheetName}".`);
        return processedData;

    } catch (error) {
        console.error(`[getRiskRegisterData] Error processing sheet "${sheetName}":`, error);
        throw new Error(`Failed to process Risk Register data from sheet "${sheetName}": ${error instanceof Error ? error.message : String(error)}`);
    }
}