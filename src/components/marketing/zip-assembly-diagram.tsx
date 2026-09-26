import {
  PencilRuler,
  FileText,
  ShieldCheck,
  Paperclip,
  FolderArchive,
  CheckCircle2,
} from "lucide-react";

const sources = [
  { icon: PencilRuler, title: "Floor plan", detail: "Openings on file" },
  { icon: FileText, title: "Forms & schedule", detail: "Matched to the jurisdiction" },
  { icon: ShieldCheck, title: "Matched NOAs", detail: "FL#s from the library" },
  { icon: Paperclip, title: "Supporting docs", detail: "Uploaded to the job" },
];

export function ZipAssemblyDiagram() {
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-3">
        {sources.map((source) => (
          <div key={source.title} className="rounded-2xl bg-muted/50 px-4 py-5 text-center">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <source.icon className="h-4 w-4" />
            </div>
            <p className="mt-3 font-heading text-sm font-semibold">{source.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{source.detail}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto my-5 h-8 w-px bg-border" aria-hidden="true" />
      <div className="mx-auto flex max-w-sm flex-col items-center rounded-2xl bg-primary px-6 py-7 text-center text-primary-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/15">
          <FolderArchive className="h-5 w-5" />
        </div>
        <p className="mt-4 font-heading text-base font-semibold">permit-package.zip</p>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Generated in one click
        </div>
      </div>
    </div>
  );
}