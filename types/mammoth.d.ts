// mammoth ships no type declarations and DefinitelyTyped has none (@types/mammoth
// does not exist) — this is a minimal ambient shim covering only the two
// documented entry points this project uses. tsconfig's default `include`
// picks this up automatically (no typeRoots override).
declare module "mammoth" {
  export type MammothMessage = {
    type: string;
    message: string;
  };

  export type MammothResult = {
    value: string;
    messages: MammothMessage[];
  };

  export type MammothInput = { buffer: Buffer } | { path: string };

  export function extractRawText(input: MammothInput): Promise<MammothResult>;
  export function convertToHtml(input: MammothInput): Promise<MammothResult>;
}
