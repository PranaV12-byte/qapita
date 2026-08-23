import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const htmlPath = "C:\\Users\\kpran_meujivq\\Downloads\\index_v9_standalone.html";
const outputPath = path.join(process.cwd(), "lib", "content", "v9-taxonomy.generated.ts");
const html = fs.readFileSync(htmlPath, "utf8");
const match = html.match(/var ktPillars = \[[\s\S]*?\n\];/);

if (!match) throw new Error("Could not locate ktPillars in the V9 HTML file.");

const sandbox = {};
vm.runInNewContext(`${match[0]}\nthis.result = ktPillars;`, sandbox);
const taxonomy = sandbox.result;

function normalize(value) {
  if (typeof value === "string") return value.replace(/[\u2013\u2014]/g, "-");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

const groups = taxonomy.map((group, groupIndex) => ({
  id: `v9-${groupIndex + 1}`,
  name: group.name,
  icon: group.icon,
  color: group.color,
  comingSoon: Boolean(group.soon),
  subtopics: group.subs.map((subtopic, subtopicIndex) => ({
    id: `v9-${groupIndex + 1}.${subtopicIndex + 1}`,
    name: subtopic.name,
    leaves: subtopic.leaves.map((name) => ({ name })),
    comingSoon: Boolean(group.soon),
  })),
}));

const output = `// Generated from index_v9_standalone.html. Run npm run extract:v9-taxonomy to refresh.\nexport type V9Leaf = { name: string };\nexport type V9Subtopic = { id: string; name: string; leaves: V9Leaf[]; comingSoon?: boolean };\nexport type V9Group = { id: string; name: string; icon: string; color: string; comingSoon?: boolean; subtopics: V9Subtopic[] };\n\nexport const V9_TAXONOMY: V9Group[] = ${JSON.stringify(normalize(groups), null, 2)};\n`;

fs.writeFileSync(outputPath, output);
console.log(`Extracted ${taxonomy.length} V9 groups to ${outputPath}.`);
