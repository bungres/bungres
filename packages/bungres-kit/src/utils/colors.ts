export function colorize(text: string, color: string): string {
  const code = Bun.color(color, "ansi");
  return code ? `${code}${text}\x1b[0m` : text;
}
