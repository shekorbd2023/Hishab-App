"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", businessName: "" });
  const [demo, setDemo] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, demo }),
    });
    if (res.ok) router.push("/dashboard");
    else setErr((await res.json()).error || "Sign up failed");
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".25rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={42} height={42} style={{ borderRadius: 10 }} />
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--brand)" }}>Hishab</span>
        </div>
        <p className="text-muted" style={{ marginBottom: "1.25rem", fontSize: ".9rem" }}>
          Create your account and business.
        </p>
        <form onSubmit={submit}>
          <label className="label">Your Name</label>
          <input className="input" value={f.name} onChange={set("name")} required />
          <div style={{ height: ".6rem" }} />
          <label className="label">Business Name</label>
          <input className="input" value={f.businessName} onChange={set("businessName")} required />
          <div style={{ height: ".6rem" }} />
          <label className="label">Email</label>
          <input className="input" type="email" value={f.email} onChange={set("email")} required />
          <div style={{ height: ".6rem" }} />
          <label className="label">Password</label>
          <input className="input" type="password" value={f.password} onChange={set("password")} required minLength={6} />
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", marginTop: ".9rem", fontSize: ".85rem" }}>
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            Load demo data (items, parties, sample invoices)
          </label>
          {err && <p style={{ color: "var(--red)", fontSize: ".85rem", marginTop: ".75rem" }}>{err}</p>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "1.1rem" }} disabled={busy}>
            {busy ? "…" : "Create Account"}
          </button>
        </form>
        <p className="text-muted" style={{ fontSize: ".85rem", marginTop: "1rem", textAlign: "center" }}>
          Have an account? <Link href="/login" className="link">Log in</Link>
        </p>
      </div>
    </div>
  );
}
