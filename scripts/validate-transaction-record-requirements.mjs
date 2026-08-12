import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = path.join(root, "kontra-ui-clone/shared/transaction_record_requirements.json");
const runtimePaths = [
  "shared/transaction_record_requirements.json",
  "kontra-ui-clone/ui/src/shared/transaction_record_requirements.json",
  "ui/src/shared/transaction_record_requirements.json",
];
const requiredWorkflowKeys = [
  "cre_acquisition",
  "business_acquisition",
  "fundraising",
  "tokenization",
  "generic",
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing transaction requirements file: ${path.relative(root, filePath)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid transaction requirements JSON at ${path.relative(root, filePath)}: ${error.message}`);
  }
}

const canonical = readJson(canonicalPath);
for (const workflowKey of requiredWorkflowKeys) {
  if (!Array.isArray(canonical[workflowKey]) || canonical[workflowKey].length === 0) {
    throw new Error(`Transaction requirements missing workflow key: ${workflowKey}`);
  }
}

const canonicalText = JSON.stringify(canonical);
for (const relativePath of runtimePaths) {
  const runtime = readJson(path.join(root, relativePath));
  if (JSON.stringify(runtime) !== canonicalText) {
    throw new Error(`Transaction requirements differ from canonical source: ${relativePath}`);
  }
}

console.log(`Transaction requirements valid: ${runtimePaths.length + 1} synchronized copies`);