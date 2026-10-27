// Minimal, self-contained PDF writer used to generate demo annexures at seed
// time. Produces a valid single-page text PDF (Helvetica) with a correct xref
// table so standard parsers (pdf.js/unpdf) can read it back.

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, "?");
}

function wrap(line: string, width = 96): string[] {
  const words = line.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width && current) {
      out.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.length ? out : [""];
}

export function buildSamplePdf(title: string, body: string[]): Uint8Array {
  const lines = [title, "", ...body.flatMap((line) => wrap(line))];
  const leading = 16;
  const startY = 800;

  let stream = `BT\n/F1 11 Tf\n1 0 0 1 54 ${startY} Tm\n${leading} TL\n`;
  for (const line of lines) {
    stream += `(${escapePdfText(line)}) Tj\nT*\n`;
  }
  stream += "ET\n";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
