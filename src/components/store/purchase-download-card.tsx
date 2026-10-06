import { Download as DownloadIcon, FileText, Music } from "lucide-react";
import { generateAgreementPdf, type AgreementData } from "@/lib/agreement-pdf";
import type { PurchaseDownload } from "@/lib/download-link.functions";

// Shared presentation for a purchase's files + signed agreement.
// Rendered by /d/<short_code> and the legacy /download/<token> route.
export function PurchaseDownloadCard({ data }: { data: PurchaseDownload }) {
  const downloadPdf = () => {
    const a: AgreementData = {
      agreement_id: data.agreementCode,
      user_name: data.buyerName || data.email,
      user_email: data.email,
      beat_title: data.beatTitle,
      beat_id: "",
      producer_name: "KRAZYJAYDOTCOM",
      license_type: data.licenseLabel,
      credits_used: 0,
      file_type: data.licenseTier === "nonexclusive" ? "MP3" : data.licenseTier === "trackout" ? "WAV + MP3 + STEMs" : "WAV + MP3",
      accepted_at: data.createdAt,
      agreement_text: `${data.rightsText}\n\nProducer credits (required): Writer — Jason A. Spencer (IPI 516703075) 50%; Publishing — March 26th Publishing (IPI 1213085595) 50%; PRO — ASCAP. Failure to register these splits voids the rights granted.\n\nRestrictions: Licensee may not resell, redistribute, sublicense, or claim sole ownership of the underlying beat. MYBEATCATALOG retains ownership of the composition and production.\n\nAmount paid: $${(data.amountCents / 100).toFixed(2)}`,
    };
    generateAgreementPdf(a).save(`MBC_${data.agreementCode}.pdf`);
  };

  return (
    <>
      <div className="flex items-center gap-4">
        {data.coverUrl ? (
          <img src={data.coverUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted"><Music className="h-6 w-6 text-muted-foreground" /></div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{data.beatTitle}</h1>
          <p className="text-sm text-muted-foreground">{data.licenseLabel} · ${(data.amountCents / 100).toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {data.mp3Url && (
          <a href={data.mp3Url} download target="_blank" rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            <DownloadIcon className="h-4 w-4" /> Download MP3
          </a>
        )}
        {data.wavUrl && (
          <a href={data.wavUrl} download target="_blank" rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            <DownloadIcon className="h-4 w-4" /> Download WAV
          </a>
        )}
        {data.stemsUrl ? (
          <a href={data.stemsUrl} target="_blank" rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            <DownloadIcon className="h-4 w-4" /> Download STEMs
          </a>
        ) : data.licenseTier === "trackout" ? (
          <p className="rounded-xl border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            Your STEMs are being prepared and will be emailed within 24 hours.
          </p>
        ) : null}
        <button type="button" onClick={downloadPdf}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent">
          <FileText className="h-4 w-4" /> Download license agreement (PDF)
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Agreement {data.agreementCode} · Licensed to {data.buyerName || data.email}
      </p>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Keep this link private — anyone with it can download these files.
      </p>
    </>
  );
}
