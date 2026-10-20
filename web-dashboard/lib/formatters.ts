/**
 * SpecScribe AR - Dedicated Timestamp & UI Formatting Utilities (T-08)
 * Standardizes integer milliseconds on the wire and provides canonical UI formatters.
 */

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function parseTimestamp(label: string): number {
  const clean = label.replace(/[\[\]\s]/g, "");
  const parts = clean.split(":");
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10);
    const sec = parseInt(parts[1], 10);
    if (!isNaN(min) && !isNaN(sec)) {
      return (min * 60 + sec) * 1000;
    }
  }
  return 0;
}
