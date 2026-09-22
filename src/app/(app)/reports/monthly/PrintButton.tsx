"use client";
import { Icon } from "@/components/ui";
export default function PrintButton() {
  return <button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" size={15} />Print PDF</button>;
}
