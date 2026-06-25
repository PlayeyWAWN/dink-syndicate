import { AppData, migrateAppData } from '@/types/app-data';

export const SESSION_TRANSFER_FORMAT = 'dink-syndicate-session-transfer';
export const SESSION_TRANSFER_VERSION = 1;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export interface SessionTransferEnvelope {
  format: typeof SESSION_TRANSFER_FORMAT;
  version: number;
  exportedAt: string;
  data: AppData;
}

export function buildExportEnvelope(data: AppData): SessionTransferEnvelope {
  return {
    format: SESSION_TRANSFER_FORMAT,
    version: SESSION_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    data: migrateAppData(data),
  };
}

export function serializeExport(data: AppData): string {
  return JSON.stringify(buildExportEnvelope(data), null, 2);
}

export function parseImportJson(json: string): AppData {
  if (json.length > MAX_IMPORT_BYTES) {
    throw new Error('Import file is too large (max 10 MB).');
  }

  const raw = JSON.parse(json) as unknown;

  if (raw && typeof raw === 'object' && 'format' in raw) {
    const envelope = raw as SessionTransferEnvelope;
    if (envelope.format !== SESSION_TRANSFER_FORMAT) {
      throw new Error('Not a Dink Syndicate session file.');
    }
    if (envelope.version !== SESSION_TRANSFER_VERSION) {
      throw new Error(`Unsupported session version: ${envelope.version}`);
    }
    return migrateAppData(envelope.data);
  }

  return migrateAppData(raw);
}

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function defaultExportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `dink-syndicate-session-${date}.json`;
}
