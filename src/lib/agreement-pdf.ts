import jsPDF from "jspdf";

export interface AgreementData {
  agreement_id: string;
  user_name: string;
  user_email: string;
  beat_title: string;
  beat_id: string;
  producer_name: string;
  license_type: string;
  credits_used: number;
  file_type: string;
  accepted_at: string;
  agreement_text: string;
}

export function generateAgreementPdf(a: AgreementData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  let y = margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("KRAZYJAYDOTCOM", margin, y);
  doc.setTextColor(220, 38, 38);
  doc.text("DOTCOM", margin + doc.getTextWidth("KRAZYJAY"), y);
  doc.setTextColor(0, 0, 0);
  y += 28;

  doc.setFontSize(14);
  doc.text("Beat Download Agreement", margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(a.agreement_text.replace(/^KRAZYJAYDOTCOM Beat Download Agreement\n*/, ""), maxWidth);
  doc.text(lines, margin, y);
  y += lines.length * 13 + 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Agreement Details", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fields: [string, string][] = [
    ["Agreement ID", a.agreement_id],
    ["User Name", a.user_name],
    ["User Email", a.user_email],
    ["Beat Title", a.beat_title],
    ["Beat ID", a.beat_id],
    ["Producer", a.producer_name],
    ["License Type", a.license_type],
    ["Credits Used", String(a.credits_used)],
    ["File Type", a.file_type],
    ["Download Date", new Date(a.accepted_at).toLocaleString()],
    ["Acceptance Timestamp", a.accepted_at],
  ];
  for (const [k, v] of fields) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, margin + 130, y);
    y += 16;
  }

  return doc;
}
