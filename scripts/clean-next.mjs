import fs from "node:fs";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
} catch (error) {
  console.warn("Failed to remove .next:", error);
}
