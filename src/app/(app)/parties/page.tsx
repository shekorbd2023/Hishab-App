import { Empty } from "@/components/ui";

export default function PartiesIndex() {
  return (
    <div className="md-empty-pane">
      <Empty icon="users" title="Party Not Selected" text="Click any party to view their transactions." />
    </div>
  );
}
