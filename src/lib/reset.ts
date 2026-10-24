import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";

/**
 * Offline password reset for the desktop app.
 * There is no email server, so the one-time code is written to a file inside the app's own
 * data folder. Only someone sitting at this computer can read it. Codes live in memory,
 * expire after 15 minutes and die after 5 wrong tries.
 */
export const RESET_FILE = path.join(DATA_DIR, "PASSWORD-RESET-CODE.txt");
const TTL = 15 * 60 * 1000, MAX_TRIES = 5, RESEND_GAP = 30 * 1000;
const codes = new Map<string, { hash: Buffer; expires: number; tries: number; at: number }>();
const sha = (s: string) => createHash("sha256").update(s).digest();

/** True only for requests made on this computer to the local server (the desktop app), never via a proxy. */
export function isLocalRequest(req: Request): boolean {
  return isLocalHeaders(req.headers);
}
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "::ffff:127.0.0.1"]);
const hostName = (h: string) => {
  const v = h.trim().toLowerCase();
  if (v.startsWith("[")) return v.slice(0, v.indexOf("]") + 1);
  return v.split(":").length > 2 ? v : v.split(":")[0]; // bare IPv6 has many colons
};
/**
 * Next.js itself fills x-forwarded-for / x-forwarded-host with the socket address and Host header,
 * so a direct local request carries loopback values there. Any public deploy (Railway proxy) adds the
 * real client IP and its own domain, which fails these checks.
 */
export function isLocalHeaders(h: { get(name: string): string | null }): boolean {
  const host = hostName(h.get("host") || "");
  if (!LOOPBACK.has(host)) return false;
  const fh = h.get("x-forwarded-host");
  if (fh && fh.split(",").some((x) => !LOOPBACK.has(hostName(x)))) return false;
  const ff = h.get("x-forwarded-for");
  if (ff && ff.split(",").some((x) => !LOOPBACK.has(x.trim().toLowerCase()))) return false;
  return true;
}

export function issueResetCode(email: string): { ok: true } | { ok: false; wait: number } {
  const prev = codes.get(email);
  const now = Date.now();
  if (prev && now - prev.at < RESEND_GAP) return { ok: false, wait: Math.ceil((RESEND_GAP - (now - prev.at)) / 1000) };
  const code = String(randomInt(0, 100000000)).padStart(8, "0");
  codes.set(email, { hash: sha(code), expires: now + TTL, tries: 0, at: now });
  const body =
    "Hishab — Password reset code / পাসওয়ার্ড রিসেট কোড\r\n\r\n" +
    `Email: ${email}\r\n` +
    `Code / কোড: ${code}\r\n\r\n` +
    "This code works for 15 minutes, one time only.\r\n" +
    "কোডটা ১৫ মিনিট কাজ করবে, শুধু একবার।\r\n\r\n" +
    "If you did not ask for this, just delete this file.\r\n" +
    "আপনি না চেয়ে থাকলে এই ফাইলটা মুছে দিন।\r\n";
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RESET_FILE, body, "utf8");
  // Ask the Electron main process (if any) to show the file in Explorer.
  try { process.send?.({ type: "hishab:reveal-reset-file", path: RESET_FILE }); } catch { /* not under Electron */ }
  return { ok: true };
}

export type CheckResult = "ok" | "wrong" | "expired" | "none";
export function checkResetCode(email: string, code: string): CheckResult {
  const c = codes.get(email);
  if (!c) return "none";
  if (Date.now() > c.expires || c.tries >= MAX_TRIES) { codes.delete(email); return "expired"; }
  const test = sha(String(code).replace(/\s+/g, ""));
  if (!timingSafeEqual(test, c.hash)) {
    c.tries++;
    if (c.tries >= MAX_TRIES) codes.delete(email);
    return "wrong";
  }
  codes.delete(email);
  try { fs.unlinkSync(RESET_FILE); } catch { /* already gone */ }
  return "ok";
}
