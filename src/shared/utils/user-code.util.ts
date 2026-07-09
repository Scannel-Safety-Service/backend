/**
 * Formats userCode to be stored as ESSP-(number)
 * If the input doesn't start with ESSP-, prepend it.
 */
export function formatUserCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!trimmed) return null;

  // Case-insensitive check for starting with "essp-"
  if (/^essp-/i.test(trimmed)) {
    const remainder = trimmed.slice(5).trim();
    return remainder ? `ESSP-${remainder}` : null;
  }
  return `ESSP-${trimmed}`;
}
