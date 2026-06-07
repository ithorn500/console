#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "../../../..");
const architectureDir = path.join(root, "docs/architecture");
const outDir = __dirname;
const puppeteerConfig = path.join(outDir, "puppeteer-config.json");

const sources = [
  {
    file: "amber-network-command-architecture-v2-2026-05-15.md",
    names: [
      "amber-network-command-architecture-v2-2026-05-15",
      "amber-network-live-runtime-flow-v2-2026-05-15",
      "gateway-monolith-runtime-v2-2026-05-15",
      "ollama-cloud-model-catalog-v2-2026-05-15",
      "veliai-portfolio-system-map-v2-2026-05-15",
      "amber-network-optimisation-map-v2-2026-05-15",
      "amber-network-service-ownership-v2-2026-05-15"
    ]
  },
  {
    file: "gateway-monolith.md",
    names: ["gateway-monolith-current-2026-06-05"]
  },
  {
    file: "veliai-system-map.md",
    names: [
      "veliai-system-map-modules-2026-06-05",
      "veliai-system-map-media-dataflow-2026-06-05",
      "veliai-system-map-recognition-paths-2026-06-05",
      "veliai-system-map-learning-loop-2026-06-05"
    ]
  },
  {
    file: "life-evidence-memory-fabric-architecture-2026-06-05.md",
    names: ["life-evidence-memory-fabric-2026-06-05"]
  },
  {
    file: "amber-network-command-architecture-2026-05-13.md",
    names: [
      "amber-network-command-view-previous-2026-05-13",
      "amber-network-runtime-demand-previous-2026-05-13"
    ]
  }
];

function extractMermaidBlocks(markdown) {
  const blocks = [];
  const pattern = /```mermaid\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push(match[1].trim() + "\n");
  }
  return blocks;
}

const manifest = [];

for (const source of sources) {
  const sourcePath = path.join(architectureDir, source.file);
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const blocks = extractMermaidBlocks(markdown);
  if (blocks.length !== source.names.length) {
    throw new Error(`${source.file} has ${blocks.length} Mermaid blocks, expected ${source.names.length}`);
  }

  blocks.forEach((block, index) => {
    const base = source.names[index];
    const mmdPath = path.join(outDir, `${base}.mmd`);
    const pngPath = path.join(outDir, `${base}.png`);
    fs.writeFileSync(mmdPath, block);
    manifest.push({
      source: path.relative(root, sourcePath),
      block: index + 1,
      mmd: path.relative(root, mmdPath),
      png: path.relative(root, pngPath)
    });
  });
}

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ generatedAt: "2026-06-05", diagrams: manifest }, null, 2) + "\n"
);

for (const item of manifest) {
  childProcess.execFileSync(
    "npx",
    [
      "--yes",
      "@mermaid-js/mermaid-cli",
      "-i",
      path.join(root, item.mmd),
      "-o",
      path.join(root, item.png),
      "-b",
      "transparent",
      "-t",
      "neutral",
      "-s",
      "2",
      "-p",
      puppeteerConfig
    ],
    { stdio: "inherit", cwd: root }
  );
}

console.log(`Rendered ${manifest.length} Mermaid diagrams into ${path.relative(root, outDir)}`);
