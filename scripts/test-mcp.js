// MCP-szerver smoke: kliens felcsatlakozik stdio-n, listáz + hív.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "..", "mcp", "server.js");

const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`✅ tools/list → ${tools.length} tool:`, tools.map((t) => t.name).join(", "));

const intake = await client.callTool({ name: "intake_reframe", arguments: { brief: "Senior Java, 10+ év, egyedül viszi a payments-et, csapatot is épít." } });
const intakeObj = JSON.parse(intake.content[0].text);
console.log("✅ intake_reframe →", intakeObj.reframed_brief ? "reframed_brief OK" : "HIÁNYZIK");

const disc = await client.callTool({ name: "discover_candidates", arguments: { search_queries: ["site:linkedin.com/in staff engineer payments"], source: "synthetic" } });
const discObj = JSON.parse(disc.content[0].text);
console.log(`✅ discover_candidates → forrás=${discObj.source}, jelöltek=${discObj.candidates.length}`);

const rank = await client.callTool({ name: "rank_targets", arguments: { candidates: discObj.candidates } });
const rankObj = JSON.parse(rank.content[0].text);
console.log(`✅ rank_targets → ${rankObj.ranked.length} rangsorolva (no-reject: mind benne = ${rankObj.ranked.length === discObj.candidates.length})`);

const art = await client.callTool({ name: "art14_notice", arguments: { candidate: discObj.candidates[0], controller: { name: "Zita Search Kft.", contact: "gdpr@zita.hu" } } });
console.log("✅ art14_notice →", JSON.parse(art.content[0].text).subject ? "értesítő OK" : "HIÁNYZIK");

await client.close();
console.log("\nMCP smoke kész.");
process.exit(0);
