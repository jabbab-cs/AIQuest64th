export async function downloadPdf(url: string, filename: string): Promise<void> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "The PDF is not available yet. Please try again after screening is complete."
        : `The PDF could not be prepared (error ${response.status}). Please try again.`,
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/pdf")) {
    throw new Error("The server returned an unexpected file instead of a PDF. Please try again.");
  }

  const blob = await response.blob();
  const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const isPdf = signature.length === 5
    && signature[0] === 0x25
    && signature[1] === 0x50
    && signature[2] === 0x44
    && signature[3] === 0x46
    && signature[4] === 0x2d;
  if (!isPdf) {
    throw new Error("The downloaded file is not a valid PDF. Please try again.");
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}