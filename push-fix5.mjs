import { ReplitConnectors } from "@replit/connectors-sdk";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const connectors = new ReplitConnectors();
const REPO = "gamilsaad92/kontra-ui";
const BRANCH = "main";
const WORKSPACE = "/home/runner/workspace";

async function ghApi(method, apiPath, body) {
  const resp = await connectors.proxy("github", apiPath, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return text; }
}

const refData = await ghApi("GET", `/repos/${REPO}/git/refs/heads/${BRANCH}`);
const remoteSha = refData?.object?.sha;
if (!remoteSha) { console.error("ERROR:", JSON.stringify(refData)); process.exit(1); }
console.log("Remote:", remoteSha);

const changedRaw = execSync("git diff-tree -r --no-commit-id --name-only HEAD", { cwd: WORKSPACE })
  .toString().trim().split("\n").filter(Boolean);
console.log("Changed:", changedRaw.join(", "));

const treeItems = [];
for (const relPath of changedRaw) {
  const absPath = path.join(WORKSPACE, relPath);
  if (!fs.existsSync(absPath)) {
    treeItems.push({ path: relPath, mode: "100644", type: "blob", sha: null });
    continue;
  }
  const blobResp = await ghApi("POST", `/repos/${REPO}/git/blobs`, {
    content: fs.readFileSync(absPath).toString("base64"), encoding: "base64",
  });
  if (!blobResp?.sha) { console.error("BLOB FAIL:", JSON.stringify(blobResp)); process.exit(1); }
  treeItems.push({ path: relPath, mode: "100644", type: "blob", sha: blobResp.sha });
  console.log("  BLOB", relPath, blobResp.sha.slice(0, 8));
}

const treeResp = await ghApi("POST", `/repos/${REPO}/git/trees`, { base_tree: remoteSha, tree: treeItems });
if (!treeResp?.sha) { console.error("TREE FAIL:", JSON.stringify(treeResp)); process.exit(1); }

const commitMsg = execSync("git log -1 --format=%B HEAD", { cwd: WORKSPACE }).toString().trim();
const commitResp = await ghApi("POST", `/repos/${REPO}/git/commits`, {
  message: commitMsg, tree: treeResp.sha, parents: [remoteSha],
  author: { name: execSync("git log -1 --format=%an HEAD", { cwd: WORKSPACE }).toString().trim(),
             email: execSync("git log -1 --format=%ae HEAD", { cwd: WORKSPACE }).toString().trim(),
             date: execSync("git log -1 --format=%aI HEAD", { cwd: WORKSPACE }).toString().trim() },
  committer: { name: execSync("git log -1 --format=%cn HEAD", { cwd: WORKSPACE }).toString().trim(),
               email: execSync("git log -1 --format=%ce HEAD", { cwd: WORKSPACE }).toString().trim(),
               date: execSync("git log -1 --format=%cI HEAD", { cwd: WORKSPACE }).toString().trim() },
});
if (!commitResp?.sha) { console.error("COMMIT FAIL:", JSON.stringify(commitResp)); process.exit(1); }

const refResp = await ghApi("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commitResp.sha, force: false });
if (!refResp?.object?.sha) { console.error("REF FAIL:", JSON.stringify(refResp)); process.exit(1); }
console.log("✅  main →", refResp.object.sha);
