export function formatProfName(name: string): string {
  if (!name) return name;
  let cleaned = name.trim();

  // Remove trailing parentheses containing institution/affiliation keywords (case-insensitive)
  cleaned = cleaned.replace(/\s*\([^)]*(?:IIT|NIT|IIIT|IIM|BITS|IISc|Univ|Inst|Tech|Coll)[^)]*\)$/i, '');

  // Remove trailing dashes/commas followed by institution/affiliation keywords (case-insensitive)
  cleaned = cleaned.replace(/\s*[-–—,]\s*(?:IIT|NIT|IIIT|IIM|BITS|IISc|Univ|Inst|College|Tech)[a-zA-Z\s\d]*$/i, '');

  // Remove trailing parenthesis containing uppercase abbreviations (case-sensitive, e.g. (MIT))
  cleaned = cleaned.replace(/\s*\([A-Z]{2,6}\)$/, '');

  cleaned = cleaned.trim();
  if (!cleaned) return cleaned;

  const titlePattern = /^(prof|professor|dr|mr|ms|mrs|miss|empr|emeritus|assoc|asst|associate|assistant|dean|dir|director|er|shri|smt|dra|hon|hon'ble|honorable|rev|reverend|sir)(\.|\b)/i;

  if (titlePattern.test(cleaned)) {
    return cleaned;
  }

  return `Prof. ${cleaned}`;
}
