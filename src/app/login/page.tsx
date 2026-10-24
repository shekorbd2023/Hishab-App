"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset")) setNotice("Password changed. Log in with your new password. / পাসওয়ার্ড বদলানো হয়েছে।");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) router.push("/dashboard");
    else setErr((await res.json()).error || "Login failed");
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".25rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={42} height={42} style={{ borderRadius: 10 }} />
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--brand)" }}>Hishab</span>
        </div>
        <p className="text-muted" style={{ marginBottom: "1.25rem", fontSize: ".9rem" }}>
          Log in to your business account.
        </p>
        <form onSubmit={submit}>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div style={{ height: ".75rem" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label className="label">Password</label>
            <Link href="/forgot-password" className="link" style={{ fontSize: ".8rem" }}>Forgot password?</Link>
          </div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {notice && <p style={{ color: "var(--green, #16a34a)", fontSize: ".85rem", marginTop: ".75rem" }}>{notice}</p>}
          {err && <p style={{ color: "var(--red)", fontSize: ".85rem", marginTop: ".75rem" }}>{err}</p>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "1.25rem" }} disabled={busy}>
            {busy ? "…" : "Log In"}
          </button>
        </form>
        <p className="text-muted" style={{ fontSize: ".85rem", marginTop: "1rem", textAlign: "center" }}>
          No account? <Link href="/signup" className="link">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
