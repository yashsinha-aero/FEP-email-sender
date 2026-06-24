export function formatProfName(name: string): string {
  if (!name) return name;
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const titlePattern = /^(prof|professor|dr|mr|ms|mrs|miss|empr|emeritus|assoc|asst|associate|assistant|dean|dir|director|er|shri|smt|dra|hon|hon'ble|honorable|rev|reverend|sir)(\.|\b)/i;

  if (titlePattern.test(trimmed)) {
    return trimmed;
  }

  return `Prof. ${trimmed}`;
}
