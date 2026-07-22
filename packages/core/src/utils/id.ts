/**
 * ID generation. UUIDs are the PK format across the data model
 * (docs/data-model.md §1). Uses the WebCrypto `crypto.randomUUID()` global —
 * available in Node, browsers, and the Capacitor webview — so this is one
 * implementation that runs everywhere, no platform branching.
 */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
