/** Fetch a signed storage URL and trigger a real Save-as download. */
export async function downloadPdfFromSignedUrl(signedUrl: string, fileName: string) {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
