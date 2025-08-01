const validCodes = new Set([
    "IvanGRT48S2A",
    "KroniSC9T3B7K",
    "Kroni",
    "DanRPT2C1V8",
    "Tbd1PLR6D9M5",
    "Tbd2AGNT4F3Z",
  ]);
  
  export function isValidAccessCode(code: string): boolean {
    if (!code) {
      return false;
    }
    return validCodes.has(code.trim());
  }