// Simple, dependency-free grouped bar chart (money in vs out), theme-aware.
export default function CashflowChart({ data }: { data: { label: string; in: number; out: number }[] }) {
  const W = 640, H = 220, padL = 44, padB = 28, padT = 10, padR = 10;
  const max = Math.max(1, ...data.flatMap((d) => [d.in, d.out]));
  const plotW = W - padL - padR;
  const plotH = H - padB - padT;
  const groupW = plotW / data.length;
  const barW = Math.min(18, groupW / 3);

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * i));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cashflow last 7 days" style={{ display: "block" }}>
      {tickVals.map((v, i) => {
        const y = padT + plotH - (v / max) * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
              {v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : v}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const gx = padL + i * groupW + groupW / 2;
        const inH = (d.in / max) * plotH;
        const outH = (d.out / max) * plotH;
        return (
          <g key={i}>
            <rect x={gx - barW - 2} y={padT + plotH - inH} width={barW} height={inH} rx="2" fill="var(--brand)" />
            <rect x={gx + 2} y={padT + plotH - outH} width={barW} height={outH} rx="2" fill="var(--red)" />
            <text x={gx} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
