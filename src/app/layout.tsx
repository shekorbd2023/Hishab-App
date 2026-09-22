import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hishab — Business Manager",
  description: "Parties, inventory, sales, purchase, POS, accounts and reports for small businesses.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1fa06f",
};

// No-flash init: restore Light / Dark / Classic / System default theme before first paint,
// and mark the opening splash as already seen for this browser session.
const themeInit = `(function(){try{var t=localStorage.getItem('hishab_theme')||'light';if(t==='system'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}if(t==='dark'||t==='classic'){document.documentElement.setAttribute('data-theme',t);}if(sessionStorage.getItem('hishab_splash')){document.documentElement.setAttribute('data-splash','seen');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
