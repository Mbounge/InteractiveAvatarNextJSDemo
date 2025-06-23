const validCodes = new Set([
    "GRT48S2A",
    "SC9T3B7K",
    "RPT2C1V8",
    "PLR6D9M5",
    "AGNT4F3Z",
  ]);
  
  export function isValidAccessCode(code: string): boolean {
    if (!code) {
      return false;
    }
    return validCodes.has(code.trim());
  }