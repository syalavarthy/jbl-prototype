import mammoth from "mammoth";

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.endsWith(".docx")) {
    return Response.json(
      { error: "Only .docx files are supported" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await mammoth.extractRawText({ buffer: buffer as any });

  return Response.json({ text: result.value, filename: file.name });
}
