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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatDateCompact(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}${dd}${yyyy}`;
}

function slugify(str: string): string {
  return str.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function buildAgreementTitle(a: AgreementData): string {
  return `MBC Unlimited License Agreement - ${a.user_name} - ${formatDate(a.accepted_at)}`;
}

export function buildAgreementFilename(a: AgreementData): string {
  const nameParts = a.user_name.trim().split(/\s+/);
  const firstName = slugify(nameParts[0] ?? "");
  const lastName = slugify(nameParts.slice(1).join(" ") || "");
  const datePart = formatDateCompact(a.accepted_at);
  const nameSuffix = lastName ? `${firstName}_${lastName}` : firstName;
  return `MBC_Unlimited_License_${nameSuffix}_${datePart}.pdf`;
}

export function generateAgreementPdf(a: AgreementData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  let y = margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;

  // Branding header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("MY", margin, y);
  doc.setTextColor(220, 38, 38);
  const myWidth = doc.getTextWidth("MY");
  doc.text("BEAT", margin + myWidth, y);
  doc.setTextColor(0, 0, 0);
  const beatWidth = doc.getTextWidth("BEAT");
  doc.text("CATALOG", margin + myWidth + beatWidth, y);
  doc.setFontSize(8);
  doc.text("TM", margin + myWidth + beatWidth + doc.getTextWidth("CATALOG") + 2, y - 8);
  doc.setFontSize(18);
  y += 28;

  // Document title
  const title = buildAgreementTitle(a);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(title, maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 18 + 10;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // Agreement body text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const bodyText = a.agreement_text
    .replace(/^KRAZYJAYDOTCOM Beat Download Agreement\n*/, "")
    .replace(/^MYBEATCATALOG Beat Download Agreement\n*/, "");
  const lines = doc.splitTextToSize(bodyText, maxWidth);
  doc.text(lines, margin, y);
  y += lines.length * 13 + 20;

  // Agreement details section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Agreement Details", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fields: [string, string][] = [
    ["Agreement ID", a.agreement_id],
    ["Licensed To", a.user_name],
    ["Email", a.user_email],
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
    doc.text(String(v), margin + 140, y);
    y += 16;
  }

  return doc;
}
