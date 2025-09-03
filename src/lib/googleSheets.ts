import { google } from 'googleapis';

interface SheetData {
  [key: string]: any;
}

interface ProjectData {
  manpower: SheetData[];
  mechanicalPlan: SheetData[];
  riskRegister: SheetData[];
}

// Simple in-memory cache for project data
let __projectDataCache: { data: ProjectData; ts: number } | null = null;
const CACHE_TTL_MS = 90 * 1000; // 90 seconds

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;

  constructor() {
    // Decode the base64 credentials
    const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!credentialsBase64) {
      throw new Error('GOOGLE_CREDENTIALS_BASE64 environment variable is not set');
    }

    const credentials = JSON.parse(
      Buffer.from(credentialsBase64, 'base64').toString('utf-8')
    );

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '';
  }

  // --- Utility: list sheet names ---
  async listSheets(): Promise<string[]> {
    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    const titles = (meta.data.sheets || [])
      .map((s: any) => s.properties?.title)
      .filter(Boolean);
    return titles as string[];
  }

  async getSheetData(sheetName: string): Promise<SheetData[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`, // Get all columns
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      // First row contains headers
      const headers = rows[0];
      const data: SheetData[] = [];

      // Convert rows to objects using headers as keys
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowData: SheetData = {};
        
        headers.forEach((header: string, index: number) => {
          rowData[header] = row[index] || '';
        });
        
        data.push(rowData);
      }

      return data;
    } catch (error) {
      console.error(`Error fetching data from sheet ${sheetName}:`, error);
      throw new Error(`Failed to fetch data from ${sheetName}`);
    }
  }

  async getProjectData(): Promise<ProjectData> {
    // Serve from cache if fresh
    if (__projectDataCache && Date.now() - __projectDataCache.ts < CACHE_TTL_MS) {
      return __projectDataCache.data;
    }

    try {
      // Try preferred sheet names first; if not found, pick best matches
      const sheetNames = await this.listSheets();
      const pick = (candidates: string[]): string | null => {
        // direct match
        for (const name of candidates) if (sheetNames.includes(name)) return name;
        // case-insensitive contains
        const lower = sheetNames.map(s => s.toLowerCase());
        for (const c of candidates.map(s => s.toLowerCase())) {
          const idx = lower.findIndex(s => s.includes(c));
          if (idx >= 0) return sheetNames[idx];
        }
        return null;
      };

      const manpowerSheet = pick(['Manpower','القوى العاملة','Resources','Man power']) || 'Manpower';
      const mechSheet = pick(['Mechanical Plan','MEP','الخطة الميكانيكية']) || 'Mechanical Plan';
      const riskSheet = pick(['RiskRegister','Risk Register','سجل المخاطر']) || 'RiskRegister';

      const [manpower, mechanicalPlan, riskRegister] = await Promise.all([
        this.getSheetData(manpowerSheet),
        this.getSheetData(mechSheet),
        this.getSheetData(riskSheet),
      ]);

      const normalized = {
        manpower: this.cleanManpowerData(manpower),
        mechanicalPlan: this.cleanMechanicalPlanData(mechanicalPlan),
        riskRegister: this.cleanRiskRegisterData(riskRegister),
      };

      __projectDataCache = { data: normalized, ts: Date.now() };
      return normalized;
    } catch (error) {
      console.error('Error fetching project data:', error);
      throw error;
    }
  }

  private cleanManpowerData(data: SheetData[]): SheetData[] {
    return data.map(row => {
      const n = (k: string) => this.parseNumber(row[k] ?? row[this.normalizeHeader(k)]);
      const p = (k: string) => this.parsePercentage(row[k] ?? row[this.normalizeHeader(k)]);

      // Flexibly map common manpower metrics
      const totalManpower = n('Total Manpower') || n('Total') || n('إجمالي القوى العاملة');
      return {
        ...row,
        Date: row['Date'] || row['التاريخ'] || row[this.normalizeHeader('Date')] || '',
        'Total Planned': n('Total Planned'),
        'Total Actual': n('Total Actual'),
        'Utilization %': p('Utilization %'),
        'Total Manpower': totalManpower,
      };
    });
  }

  private cleanMechanicalPlanData(data: SheetData[]): SheetData[] {
    return data.map(row => ({
      ...row,
      'Progress %': this.parsePercentage(row['Progress %'] ?? row['Progress'] ?? row['نسبة التقدم']),
      'Planned Duration': this.parseNumber(row['Planned Duration'] ?? row['المدة المخططة']),
      'Actual Duration': this.parseNumber(row['Actual Duration'] ?? row['المدة الفعلية']),
    }));
  }

  private cleanRiskRegisterData(data: SheetData[]): SheetData[] {
    return data.map(row => ({
      ...row,
      'Probability': this.parseNumber(row['Probability'] ?? row['الاحتمالية']),
      'Impact': this.parseNumber(row['Impact'] ?? row['التأثير']),
      'Risk Score': this.parseNumber(row['Risk Score'] ?? row['درجة المخاطر'] ?? row['RiskScore']),
    }));
  }

  private parsePercentage(value: string): number {
    if (!value) return 0;
    const v = value.toString().replace('٪','%');
    const parsed = parseFloat(v.replace('%', ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  private parseNumber(value: string): number {
    if (!value) return 0;
    const v = value.toString().replace(/٬/g, ',').replace(/٫/g, '.');
    const parsed = parseFloat(v);
    return isNaN(parsed) ? 0 : parsed;
  }

  // --- Normalization helpers ---
  private normalizeHeader(h: string): string {
    if (!h) return '';
    const s = h
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u064B-\u0652]/g, '') // remove Arabic diacritics
      .replace(/[%\s_\-]+/g, ' ')
      .trim();

    const map: Record<string, string[]> = {
      'total planned': ['total planned','اجمالي المخطط','إجمالي المخطط'],
      'total actual': ['total actual','اجمالي الفعلي','إجمالي الفعلي'],
      'utilization %': ['utilization %','utilization','نسبة الاستخدام','استخدام %'],
      'progress %': ['progress %','progress','نسبة التقدم','الانجاز %'],
      'planned duration': ['planned duration','المدة المخططة'],
      'actual duration': ['actual duration','المدة الفعلية'],
      'probability': ['probability','الاحتمالية'],
      'impact': ['impact','التأثير'],
      'risk score': ['risk score','riskscore','درجة المخاطر'],
      'date': ['date','التاريخ'],
      'total manpower': ['total manpower','اجمالي القوى العاملة','إجمالي القوى العاملة','total'],
    };

    for (const key of Object.keys(map)) {
      if (map[key].some(alias => s === alias)) return key;
    }
    return s;
  }

  // Build a catalog of sheets with headers and sample rows
  async buildCatalog(sampleRows = 3): Promise<{
    sheets: Array<{ name: string; headers: string[]; normalizedHeaders: string[]; sample: SheetData[] }>
  }> {
    const names = await this.listSheets();
    const sheets: Array<{ name: string; headers: string[]; normalizedHeaders: string[]; sample: SheetData[] }> = [];

    for (const name of names) {
      const data = await this.getSheetData(name);
      if (data.length === 0) {
        sheets.push({ name, headers: [], normalizedHeaders: [], sample: [] });
        continue;
      }
      const headers = Object.keys(data[0] || {});
      const normalizedHeaders = headers.map(h => this.normalizeHeader(h));
      sheets.push({ name, headers, normalizedHeaders, sample: data.slice(0, sampleRows) });
    }

    return { sheets };
  }
}
