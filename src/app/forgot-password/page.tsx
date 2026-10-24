"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [file, setFile] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setErr("");
    const { ok, data } = await call("/api/auth/forgot", { email });
    if (ok) { setFile(data.file || ""); setStep(2); } else setErr(data.error || "Could not create a code");
    setBusy(false);
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setErr("New passwords do not match / নতুন পাসওয়ার্ড দুটো মিলছে না"); return; }
    setBusy(true); setErr("");
    const { ok, data } = await call("/api/auth/reset", { email, code, new_password: pw });
    if (ok) router.push("/login?reset=1"); else setErr(data.error || "Could not reset");
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--brand)", marginBottom: ".25rem" }}>Reset password</div>
        <p className="text-muted" style={{ fontSize: ".9rem", marginBottom: "1.25rem" }}>পাসওয়ার্ড ভুলে গেছেন? নতুন পাসওয়ার্ড সেট করুন।</p>
        {step === 1 ? (
          <form onSubmit={sendCode}>
            <label className="label">Login email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <p className="text-muted" style={{ fontSize: ".8rem", marginTop: ".6rem" }}>
              A one-time code will be saved as a file in Hishab&apos;s data folder on this computer.
              <br />এই কম্পিউটারে হিসাবের ডেটা ফোল্ডারে একটা কোডের ফাইল তৈরি হবে।
            </p>
            {err && <p style={{ color: "var(--red)", fontSize: ".85rem", marginTop: ".75rem" }}>{err}</p>}
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "1.1rem" }} disabled={busy}>{busy ? "…" : "Get code / কোড নিন"}</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <div style={{ background: "var(--surface-2, rgba(127,127,127,.12))", borderRadius: 8, padding: ".75rem", fontSize: ".82rem", marginBottom: "1rem" }}>
              Open this file to see your 8-digit code (Explorer may have opened it for you):
              <br />এই ফাইলটা খুলে ৮ সংখ্যার কোডটা দেখুন:
              <div style={{ fontFamily: "monospace", wordBreak: "break-all", marginTop: ".4rem", userSelect: "all" }}>{file}</div>
            </div>
            <label className="label">Code / কোড</label>
            <input className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
            <div style={{ height: ".75rem" }} />
            <label className="label">New password / নতুন পাসওয়ার্ড</label>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
            <div style={{ height: ".75rem" }} />
            <label className="label">Confirm new password</label>
            <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={6} />
            {err && <p style={{ color: "var(--red)", fontSize: ".85rem", marginTop: ".75rem" }}>{err}</p>}
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "1.1rem" }} disabled={busy}>{busy ? "…" : "Set new password"}</button>
            <button type="button" className="btn" style={{ width: "100%", justifyContent: "center", marginTop: ".5rem" }} onClick={() => sendCode()} disabled={busy}>Send a new code</button>
          </form>
        )}
        <p className="text-muted" style={{ fontSize: ".85rem", marginTop: "1rem", textAlign: "center" }}>
          <Link href="/login" className="link">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
