/** Logo sizing for stats export PNG headers. */

export const EXPORT_LOGO_MAX_WIDTH = 240;
export const EXPORT_LOGO_PREFERRED_HEIGHT = 220;

export function fitLogoToBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  };
}

function applyLogoDimensions(
  logo: HTMLImageElement,
  maxWidth: number,
  maxHeight: number
): void {
  if (!logo.naturalWidth) return;

  const { width, height } = fitLogoToBox(
    logo.naturalWidth,
    logo.naturalHeight,
    maxWidth,
    maxHeight
  );
  logo.style.width = `${width}px`;
  logo.style.height = `${height}px`;
}

async function whenLogoReady(logo: HTMLImageElement): Promise<void> {
  if (logo.complete && logo.naturalWidth > 0) {
    if (typeof logo.decode === 'function') {
      await logo.decode().catch(() => undefined);
    }
    return;
  }

  await new Promise<void>((resolve) => {
    const done = async () => {
      if (typeof logo.decode === 'function') {
        await logo.decode().catch(() => undefined);
      }
      resolve();
    };
    logo.addEventListener('load', () => void done(), { once: true });
    logo.addEventListener('error', () => resolve(), { once: true });
  });
}

export function applyExportLogoDimensions(
  logo: HTMLImageElement,
  maxHeight: number = EXPORT_LOGO_PREFERRED_HEIGHT,
  maxWidth: number = EXPORT_LOGO_MAX_WIDTH
): Promise<void> {
  return whenLogoReady(logo).then(() => {
    applyLogoDimensions(logo, maxWidth, maxHeight);
  });
}

/** Applies final logo dimensions before html2canvas capture. */
export async function finalizeExportReportLayout(root: HTMLElement): Promise<void> {
  const logo = root.querySelector('.stats-export-report__logo') as HTMLImageElement | null;
  if (!logo) return;

  await applyExportLogoDimensions(logo);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
