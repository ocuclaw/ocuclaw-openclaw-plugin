import process from "node:process";

export function terminalAllowsColor(output, environment = process.env) {
  return output?.isTTY === true && Boolean(environment.TERM) && environment.TERM !== "dumb" &&
    environment.NO_COLOR === undefined;
}

export function terminalText(text, role, output, environment = process.env) {
  if (!terminalAllowsColor(output, environment)) return text;
  const code = role === "heading" ? "32" : role === "action" ? "33" : role === "detail" ? "2" : null;
  return code ? `\u001b[${code}m${text}\u001b[0m` : text;
}
