import SettingsNav from "./SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="set-wrap">
      <SettingsNav />
      <div className="set-main">{children}</div>
    </div>
  );
}
