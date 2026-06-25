/** DOM capture helpers for offline PNG downloads. */

import { finalizeExportReportLayout } from '@/lib/export-logo';
import { StatsView, statsViewExportSlug } from '@/modules/stats/StatsReportService';

const EXPORT_REPORT_BG = '#334155';
const EXPORT_REPORT_TEXT = '#f8fafc';

export function sanitizeExportSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function buildStatsExportFilename(
  sessionName: string,
  suffix: 'summary' | 'rankings',
  statsView: StatsView,
  date = new Date()
): string {
  const label = sanitizeExportSegment(sessionName) || 'session';
  const scope = statsViewExportSlug(statsView);
  const day = date.toISOString().slice(0, 10);
  return `dink-${label}-${scope}-${suffix}-${day}.png`;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
        });
      }
      if (typeof image.decode === 'function') {
        await image.decode().catch(() => undefined);
      }
    })
  );
}

export async function exportElementAsPng(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    backgroundColor: EXPORT_REPORT_BG,
    scale: Math.max(2, window.devicePixelRatio || 1),
    useCORS: true,
    logging: false,
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Failed to create PNG'));
    }, 'image/png');
  });

  downloadBlob(filename, blob);
}

/** Renders a dedicated off-screen report node, captures it, then removes it. */
export async function exportReportAsPng(
  reportElement: HTMLElement,
  filename: string
): Promise<void> {
  reportElement.style.position = 'fixed';
  reportElement.style.left = '-10000px';
  reportElement.style.top = '0';
  reportElement.style.zIndex = '-1';
  reportElement.style.pointerEvents = 'none';
  reportElement.style.color = EXPORT_REPORT_TEXT;

  document.body.appendChild(reportElement);

  try {
    await waitForImages(reportElement);
    if ('fonts' in document) {
      await document.fonts.ready;
    }
    await finalizeExportReportLayout(reportElement);
    await exportElementAsPng(reportElement, filename);
  } finally {
    reportElement.remove();
  }
}
