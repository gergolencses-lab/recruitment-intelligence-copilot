// Surface B — MCP szerver (stdio). A KÖZÖS magot (core/index.js) burkolja tool-okba.
// A tudás + a scraping szerver-oldalon marad; a kliens csak a tool-okat látja.
// A recruiter a saját AI-eszközében (Claude Desktop / stb.) használja.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as ric from "../core/index.js";

const OBJ = { type: "object", additionalProperties: true };
const STR = { type: "string" };

const TOOLS = [
  {
    name: "intake_reframe",
    description: "🧠 Brief elemzése: javasolt pozíció-összefoglaló a hiring manager briefjéből — tisztázandó pontok, feltételezett további igények, keresési hipotézisek. Minden kimenet javaslat, a recruiter ellenőrzi.",
    inputSchema: { type: "object", properties: { brief: STR }, required: ["brief"] },
    run: (a) => ric.intakeReframe({ brief: a.brief }),
  },
  {
    name: "query_build",
    description: "🧠 Keresési terv készítése: boolean lekérdezések + 'firecrawl_search_queries', amelyek a nyilvános webes jelöltkutatást vezérlik (senior tech / CEE).",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.queryBuild({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "discover_candidates",
    description: "📡 Jelöltkutatás nyilvánosan elérhető szakmai forrásokban (nincs belépett/fake-account LinkedIn-hozzáférés). Kulcs nélkül mintaadatokkal fut. Bemenet: a query_build 'firecrawl_search_queries' listája.",
    inputSchema: { type: "object", properties: { search_queries: { type: "array", items: STR }, source: { type: "string", enum: ["auto", "firecrawl", "synthetic"] } }, required: ["search_queries"] },
    run: (a) => ric.discoverCandidates({ searchQueries: a.search_queries, source: a.source }),
  },
  {
    name: "talent_map",
    description: "📡 Célpiac-térkép: célcégek + indoklás + valószínű szerepek + hol találkoznak a szerephez illő emberek (közösség, konferencia).",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.talentMap({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "profile_assess",
    description: "🧠 Jelöltprofil összegzése, kizárólag a jeleiből visszavezethető evidenciával. Őszinte alkalmasság-értékelés (erős/közepes/gyenge/nem fit) — lehet elutasító is. Amit a jelekből nem tudni, az 'unknowns'-ba kerül; kitalált tény tilos.",
    inputSchema: { type: "object", properties: { candidate: OBJ, intake: OBJ }, required: ["candidate"] },
    run: (a) => ric.profileAssess({ candidate: a.candidate, intake: a.intake }),
  },
  {
    name: "rank_targets",
    description: "🧠 Prioritási javaslat: kivel érdemes először felvenni a kapcsolatot (A: elsőként, B: következő kör, C: figyelőlista, D: most nem javasolt). Minden jelölt elszámolva — senki nem esik ki némán; a recruiter felülbírálhatja.",
    inputSchema: { type: "object", properties: { candidates: { type: "array", items: OBJ }, intake: OBJ }, required: ["candidates"] },
    run: (a) => ric.rankTargets({ candidates: a.candidates, intake: a.intake }),
  },
  {
    name: "attraction_strategy",
    description: "⭐ Megközelítési terv EGY jelöltre, két élesen elválasztott részben: (1) forrással igazolt tények a jelekből, (2) nyíltan feltételezés-alapú megközelítési ötletek — nyitómondat, csatorna, időzítés, kerülendő megközelítések.",
    inputSchema: { type: "object", properties: { candidate: OBJ, assessment: OBJ, intake: OBJ }, required: ["candidate"] },
    run: (a) => ric.attractionStrategy({ candidate: a.candidate, assessment: a.assessment, intake: a.intake }),
  },
  {
    name: "outreach_draft",
    description: "🧠 A megközelítési tervből személyre szabott üzenetvázlat (a rendszer nem küld semmit; a recruiter ellenőrzi és küldi). Az első mondat a jelölt saját munkájához kötve.",
    inputSchema: { type: "object", properties: { candidate: OBJ, attraction: OBJ, language: STR }, required: ["candidate"] },
    run: (a) => ric.outreachDraft({ candidate: a.candidate, attraction: a.attraction, language: a.language }),
  },
  {
    name: "client_advisory",
    description: "🧠 Felkészülés a hiring managerrel való egyeztetésre: piaci jelek, tisztázandó briefpontok, folyamat-kockázatok.",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.clientAdvisory({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "interview_intel",
    description: "🧠 Interjúterv a kompetenciamodellből — kompetenciánként 1 éles kérdés + mit jelez egy erős válasz + tisztázandó jelek.",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.interviewIntel({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "recruitment_coach",
    description: "🧠 Módszertani segítség a recruiternek: javasolt megközelítés indoklással + egy konkrét, most bevethető lépés. Fejleszt, nem csak outputot ad.",
    inputSchema: { type: "object", properties: { context: STR }, required: ["context"] },
    run: (a) => ric.recruitmentCoach({ context: a.context }),
  },
  {
    name: "art14_notice",
    description: "⚖️ GDPR Art. 14 értesítő-generátor: a felkutatott jelöltnek kötelező tájékoztató (adatkezelő, cél, FORRÁS, jogok). Scraping-alapú discovery esetén kötelező.",
    inputSchema: { type: "object", properties: { candidate: OBJ, controller: { type: "object", properties: { name: STR, contact: STR } } }, required: ["candidate"] },
    run: (a) => ric.art14Notice({ candidate: a.candidate, controller: a.controller }),
  },
  {
    name: "project_memory_save",
    description: "🗂️ Megbízás-szintű jegyzet mentése (megbízás/ügyfél/jelölt kontextus). Szigorúan silózva, nincs megbízások közti átjárás.",
    inputSchema: { type: "object", properties: { project_id: STR, project_name: STR, note: STR, kind: STR }, required: ["project_id", "note"] },
    run: (a) => ric.memorySave({ projectId: a.project_id, projectName: a.project_name, note: a.note, kind: a.kind }),
  },
  {
    name: "project_memory_recall",
    description: "🗂️ Egy megbízás jegyzeteinek előhívása.",
    inputSchema: { type: "object", properties: { project_id: STR }, required: ["project_id"] },
    run: (a) => ric.memoryRecall({ projectId: a.project_id }),
  },
];

const server = new Server(
  { name: "recruitment-intelligence-copilot", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Ismeretlen tool: ${req.params.name}` }] };
  }
  try {
    const result = await tool.run(req.params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: `Hiba (${tool.name}): ${String(e.message || e)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `Recruitment Intelligence MCP szerver fut (stdio). Mód: ${ric.brainAvailable() ? "AI elérhető" : "bemutató"} | Adatforrás: ${ric.reachLiveAvailable() ? "nyilvános web" : "mintaadatok"} | ${TOOLS.length} tool.`
);
