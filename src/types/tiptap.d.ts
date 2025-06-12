import '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    // This tells TypeScript that these commands exist on the editor instance
    setFontSize: (size: string) => ReturnType;
    unsetFontSize: () => ReturnType;
  }
}