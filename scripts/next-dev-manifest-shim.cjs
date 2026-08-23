const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.join(process.cwd(), ".next", "prerender-manifest.json");
const originalReadFile = fs.promises.readFile.bind(fs.promises);
const originalWriteFile = fs.promises.writeFile.bind(fs.promises);
const originalRename = fs.promises.rename.bind(fs.promises);
let writeQueue = Promise.resolve();
let temporaryFileNumber = 0;

const developmentManifest = {
  version: 4,
  routes: {},
  dynamicRoutes: {},
  notFoundRoutes: [],
  preview: {
    previewModeId: "development-id",
    previewModeSigningKey: "development-signing-key",
    previewModeEncryptionKey: "development-encryption-key",
  },
};

function isPrerenderManifest(file) {
  return path.resolve(String(file)) === manifestPath;
}

function ensureManifest() {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  try {
    JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    fs.writeFileSync(manifestPath, JSON.stringify(developmentManifest));
  }
}

ensureManifest();

// Next.js 15 writes this dev-only manifest in place. Atomic replacement keeps
// requests from reading a partially-written JSON document during hot reloads.
fs.promises.writeFile = function writeFileAtomically(file, data, options) {
  if (!isPrerenderManifest(file)) {
    return originalWriteFile(file, data, options);
  }

  const write = async () => {
    const temporaryPath = `${manifestPath}.${process.pid}.${temporaryFileNumber += 1}.tmp`;
    await originalWriteFile(temporaryPath, data, options);
    await originalRename(temporaryPath, manifestPath);
  };

  writeQueue = writeQueue.then(write, write);
  return writeQueue;
};

fs.promises.readFile = async function readManifestSafely(file, options) {
  if (!isPrerenderManifest(file)) {
    return originalReadFile(file, options);
  }

  await writeQueue;
  return originalReadFile(file, options);
};
