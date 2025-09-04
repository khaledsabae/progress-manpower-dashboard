// src/services/grandeur.ts

export interface ParsedCommand {
  command: string;
  args: string[];
}

export interface GrandeurCommandResult {
  success: boolean;
  data?: any;
  message: string;
}

/**
 * Parses a slash command into command and arguments.
 * @param input The input string starting with '/'
 * @returns ParsedCommand object
 */
export function parseSlashCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    throw new Error('Command must start with /');
  }
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { command, args };
}

/**
 * Executes a grandeur command based on the parsed command.
 * @param params Object containing command, args, and locale
 * @returns Promise<GrandeurCommandResult>
 */
export async function executeGrandeurCommand(params: {
  command: string;
  args: string[];
  locale: 'en' | 'ar';
}): Promise<GrandeurCommandResult> {
  const { command, args, locale } = params;

  try {
    switch (command) {
      case 'status':
        return {
          success: true,
          message: locale === 'ar' ? 'حالة النظام: نشط' : 'System status: Active'
        };
      case 'help':
        return {
          success: true,
          message: locale === 'ar' ? 'الأوامر المتاحة: /status, /help, /version' : 'Available commands: /status, /help, /version'
        };
      case 'version':
        return {
          success: true,
          message: 'Grandeur Module Version 1.0'
        };
      default:
        return {
          success: false,
          message: locale === 'ar' ? `الأمر غير معروف: ${command}` : `Unknown command: ${command}`
        };
    }
  } catch (error) {
    return {
      success: false,
      message: locale === 'ar' ? 'خطأ في تنفيذ الأمر' : 'Error executing command'
    };
  }
}

/**
 * Formats the result for chat response.
 * @param result GrandeurCommandResult
 * @param locale Language locale
 * @returns Formatted string
 */
export function formatResultForChat(result: GrandeurCommandResult, locale: 'en' | 'ar'): string {
  if (result.success) {
    return result.message;
  } else {
    return locale === 'ar' ? `خطأ: ${result.message}` : `Error: ${result.message}`;
  }
}
