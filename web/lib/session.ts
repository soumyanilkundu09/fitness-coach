/**
 * The agent's memory is keyed on the session id, so it must stay stable for the
 * whole conversation and be impossible to guess — n8n stores the raw transcript
 * against it. Never derive it from anything about the person.
 */
export const createSessionId = randomId;

/** Also used for message keys, where uniqueness is all that matters. */
export function randomId(): string {
  // randomUUID only exists in a secure context (https, or localhost). Opening
  // the dev server over a LAN IP is plain http, where it is undefined.
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  throw new Error("No secure random source available for the session id.");
}
