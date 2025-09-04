import { google } from 'googleapis';
import { withTimeout, SHEETS_TIMEOUT_MS, TimeoutError, isTimeoutError } from '@/lib/http/timeout';

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
    google.options({ timeout: SHEETS_TIMEOUT_MS });
    this.spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '';
  }

  // --- Utility: list sheet names ---
  async listSheets(): Promise<string[]> {
    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      timeout: SHEETS_TIMEOUT_MS,
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
        timeout: SHEETS_TIMEOUT_MS,
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
      const normalized: ProjectData = await withTimeout((async (): Promise<ProjectData> => {
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

        return {
          manpower: this.cleanManpowerData(manpower),
          mechanicalPlan: this.cleanMechanicalPlanData(mechanicalPlan),
          riskRegister: this.cleanRiskRegisterData(riskRegister),
        };
      })(), SHEETS_TIMEOUT_MS, 'getProjectData');

      __projectDataCache = { data: normalized, ts: Date.now() };
      return normalized;
    } catch (error) {
      if (isTimeoutError(error)) {
        console.error('Timeout fetching project data:', error);
        throw new TimeoutError('Project data fetch timed out', SHEETS_TIMEOUT_MS, 'getProjectData', error);
      }
      console.error('Error fetching project data:', error);
      throw error;
    }
  }

  public cleanManpowerData(data: SheetData[]): SheetData[] {
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

  public cleanMechanicalPlanData(data: SheetData[]): SheetData[] {
    return data.map(row => ({
      ...row,
      'Progress %': this.parsePercentage(row['Progress %'] ?? row['Progress'] ?? row['نسبة التقدم']),
      'Planned Duration': this.parseNumber(row['Planned Duration'] ?? row['المدة المخططة']),
      'Actual Duration': this.parseNumber(row['Actual Duration'] ?? row['المدة الفعلية']),
    }));
  }

  public cleanRiskRegisterData(data: SheetData[]): SheetData[] {
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

  // --- Module 1: Monthly tabs discovery & naming normalization ---
  // Local types for Module 1 utilities
  // Canonical YearMonth must be zero-padded and hyphen-separated, e.g., "2025-09"
  private static readonly YM_REGEX = /^(\d{4})-(\d{2})$/;
  private static readonly MONTH_NAMES: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  // Normalize a variety of inputs into canonical YYYY-MM or return null if invalid
  // Supported patterns include: YYYY-M, YYYY/MM, YYYY_MM, YYYYMM, "Sep 2025", "September 2025",
  // and titles containing a date fragment, e.g., "Mechanical Plan (2025-9)".
  normalizeYearMonth(input: string | null | undefined): string | null {
    if (!input) return null;
    const s = input.toString().trim();
    if (!s) return null;

    // 1) Direct canonical
    const m0 = s.match(GoogleSheetsService.YM_REGEX);
    if (m0) {
      const year = parseInt(m0[1], 10);
      const month = parseInt(m0[2], 10);
      if (month >= 1 && month <= 12) return `${year}-${m0[2]}`;
      return null;
    }

    // 2) Variants: YYYY-M (no padding), YYYY/MM, YYYY_MM, YYYY MM
    const m1 = s.match(/^(\d{4})[\/_\s-]?(\d{1,2})$/);
    if (m1) {
      const year = parseInt(m1[1], 10);
      const month = parseInt(m1[2], 10);
      if (month >= 1 && month <= 12) {
        const mm = month.toString().padStart(2, '0');
        return `${year}-${mm}`;
      }
      return null;
    }

    // 3) Concise numeric: YYYYMM (6 digits), ensure valid month
    const m2 = s.match(/^(\d{4})(\d{2})$/);
    if (m2) {
      const year = parseInt(m2[1], 10);
      const month = parseInt(m2[2], 10);
      if (month >= 1 && month <= 12) {
        const mm = month.toString().padStart(2, '0');
        return `${year}-${mm}`;
      }
      return null;
    }

    // 4) Month name + year: e.g., "Sep 2025", "September 2025"
    const lower = s.toLowerCase();
    const nameYear = lower.match(/(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[^0-9]*?(\d{4})/i);
    if (nameYear) {
      const name = nameYear[1].toLowerCase();
      const year = parseInt(nameYear[2], 10);
      const month = GoogleSheetsService.MONTH_NAMES[name];
      if (month) {
        const mm = month.toString().padStart(2, '0');
        return `${year}-${mm}`;
      }
      return null;
    }

    return null;
  }

  // Extract canonical YYYY-MM from a sheet title by scanning for common patterns.
  // If multiple candidates appear, return the last valid occurrence (often the most specific/recent in titles).
  extractYearMonthFromTitle(title: string): string | null {
    if (!title) return null;
    const fragments: string[] = [];
    const addCandidate = (raw: string) => {
      const ym = this.normalizeYearMonth(raw);
      if (ym) fragments.push(ym);
    };

    // Scan for common numeric/date fragments
    const matches = title.match(/\d{4}[\/_\-\s]?\d{1,2}|\d{6}|(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)[^0-9]*?\d{4}/gi);
    if (matches) {
      for (const m of matches) addCandidate(m);
    }

    // Fallback: try the whole string
    addCandidate(title);

    if (fragments.length === 0) return null;
    // Prefer the last valid candidate found in the title
    return fragments[fragments.length - 1] || null;
  }

  // Detailed sheets listing with metadata
  private async listSheetsWithMeta(): Promise<Array<{ sheetId: number; index: number; title: string }>> {
    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      timeout: SHEETS_TIMEOUT_MS,
    });
    const sheets = (meta.data.sheets || [])
      .map((s: any) => ({
        sheetId: s.properties?.sheetId as number,
        index: s.properties?.index as number,
        title: s.properties?.title as string,
      }))
      .filter((s: { sheetId: number; index: number; title: string }) => Number.isInteger(s.sheetId) && Number.isInteger(s.index) && !!s.title);
    return sheets;
  }

  // List monthly tabs with normalized YearMonth and deterministic duplicate handling.
  // Duplicate rule: If multiple tabs normalize to the same YYYY-MM, prefer exact title === YYYY-MM, else the one with the highest index.
  async listMonthlyTabs(): Promise<Array<{ sheetId: number; index: number; sheetTitle: string; yearMonth: string; year: number; month: number }>> {
    const sheets = await this.listSheetsWithMeta();
    const candidates = sheets
      .map(s => {
        const ym = this.extractYearMonthFromTitle(s.title);
        return ym ? { ...s, yearMonth: ym } : null;
      })
      .filter(Boolean) as Array<{ sheetId: number; index: number; title: string; yearMonth: string }>;

    if (candidates.length === 0) return [];

    // Deduplicate by yearMonth with tie-breaking rule
    const byYM = new Map<string, { sheetId: number; index: number; title: string; yearMonth: string }>();
    for (const c of candidates) {
      const prev = byYM.get(c.yearMonth);
      if (!prev) {
        byYM.set(c.yearMonth, c);
        continue;
      }
      const exactPrev = prev.title === prev.yearMonth;
      const exactCurr = c.title === c.yearMonth;
      if (exactCurr && !exactPrev) {
        byYM.set(c.yearMonth, c);
      } else if (exactCurr === exactPrev) {
        // Tie-breaker: higher index wins (usually newer/last)
        if (c.index > prev.index) byYM.set(c.yearMonth, c);
      }
    }

    const metas = Array.from(byYM.values()).map(c => {
      const [y, m] = c.yearMonth.split('-');
      return {
        sheetId: c.sheetId,
        index: c.index,
        sheetTitle: c.title,
        yearMonth: c.yearMonth,
        year: parseInt(y, 10),
        month: parseInt(m, 10),
      };
    });

    // Sort chronologically ascending by canonical YYYY-MM (lexicographic works)
    metas.sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : a.yearMonth > b.yearMonth ? 1 : 0));
    return metas;
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
