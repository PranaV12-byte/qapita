function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export async function buildEmbedInput(
  title: string | undefined,
  headingPath: string | undefined,
  text: string
): Promise<string> {
  return [compact(title), compact(headingPath), compact(text)]
    .filter(Boolean)
    .join("\n\n");
}
