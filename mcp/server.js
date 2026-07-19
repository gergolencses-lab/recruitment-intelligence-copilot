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
    description: "🧠 Egy senior fejvadász szemével keretezi ÚJRA a hiring manager briefjét: kiszúrja a rossz/ellentmondó briefet, a rejtett valódi igényt, és hol vannak ezek az emberek. Nem hoz döntést a jelöltről.",
    inputSchema: { type: "object", properties: { brief: STR }, required: ["brief"] },
    run: (a) => ric.intakeReframe({ brief: a.brief }),
  },
  {
    name: "query_build",
    description: "🧠 Keresési stratégiát épít: boolean lekérdezések + 'firecrawl_search_queries', amik a publikus-web felkutatást vezérlik (senior tech / CEE).",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.queryBuild({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "discover_candidates",
    description: "📡 Passzív jelöltek felkutatása a Reach Engine-nel (Firecrawl publikus-web keresés + scraping; nincs belépett/fake-account LinkedIn-scraping). Kulcs nélkül szintetikus pool. Bemenet: a query_build 'firecrawl_search_queries' listája.",
    inputSchema: { type: "object", properties: { search_queries: { type: "array", items: STR }, source: { type: "string", enum: ["auto", "firecrawl", "synthetic"] } }, required: ["search_queries"] },
    run: (a) => ric.discoverCandidates({ searchQueries: a.search_queries, source: a.source }),
  },
  {
    name: "talent_map",
    description: "📡 Talent map: célcégek + miért + milyen szerepek + hol gyűlnek a legjobbak (közösség, konferencia).",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.talentMap({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "profile_assess",
    description: "🧠 Őszinte fit-olvasat egy jelöltről, KIZÁRÓLAG a jeleiből visszavezethető evidenciával. Kimondja, mennyire fit (erős/közepes/gyenge/nem fit) — akár elutasító is lehet. Amit a jelekből nem tudni, az 'unknowns'-ba kerül; kitalált tény tilos.",
    inputSchema: { type: "object", properties: { candidate: OBJ, intake: OBJ }, required: ["candidate"] },
    run: (a) => ric.profileAssess({ candidate: a.candidate, intake: a.intake }),
  },
  {
    name: "rank_targets",
    description: "🧠 A jelölteket ÜLDÖZÉSI prioritásba rangsorolja (A: most, B: párhuzamos, C: melegen tartsd). SOHA nem elutasítás — senki nem esik ki, mindenki kap helyet a sorban.",
    inputSchema: { type: "object", properties: { candidates: { type: "array", items: OBJ }, intake: OBJ }, required: ["candidates"] },
    run: (a) => ric.rankTargets({ candidates: a.candidates, intake: a.intake }),
  },
  {
    name: "attraction_strategy",
    description: "⭐ A termék szíve: BESPOKE elcsábítási stratégia EGY top célszemélyre — mi mozgatja (evidenciával), a szög, a horog, a timing, az ajánlati karok, a csatorna, a kockázatok. A kérdés sosem 'megfelel-e', hanem 'hogyan nyerjük meg'.",
    inputSchema: { type: "object", properties: { candidate: OBJ, assessment: OBJ, intake: OBJ }, required: ["candidate"] },
    run: (a) => ric.attractionStrategy({ candidate: a.candidate, assessment: a.assessment, intake: a.intake }),
  },
  {
    name: "outreach_draft",
    description: "🧠 Az elcsábítási stratégiából személyre szabott megkereső-DRAFT (a rendszer nem küld semmit; a recruiter nézi át). Az első mondat a jelölt saját munkájához kötve.",
    inputSchema: { type: "object", properties: { candidate: OBJ, attraction: OBJ, language: STR }, required: ["candidate"] },
    run: (a) => ric.outreachDraft({ candidate: a.candidate, attraction: a.attraction, language: a.language }),
  },
  {
    name: "client_advisory",
    description: "🧠 Talking pointok a hiring managernek — 'tűnj seniornak': piaci jelek, hol rossz a brief, mire figyelj a folyamatban.",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.clientAdvisory({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "interview_intel",
    description: "🧠 Interjúkérdések a kompetenciamodellből — kompetenciánként 1 éles kérdés + mi a jó válasz + red flag-ek.",
    inputSchema: { type: "object", properties: { intake: OBJ, brief: STR } },
    run: (a) => ric.interviewIntel({ intake: a.intake, brief: a.brief }),
  },
  {
    name: "recruitment_coach",
    description: "🧠 Módszertani coaching a recruiternek: egy senior itt mit csinált volna másképp + egy konkrét, most bevethető fogás. A differenciátor: fejleszt, nem csak outputot ad.",
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
    description: "🗂️ Kliens-silózott projekt-memória: jegyzet mentése (projekt/kliens/jelölt kontextus). Szigorúan silózva, nincs cross-projekt átjárás.",
    inputSchema: { type: "object", properties: { project_id: STR, project_name: STR, note: STR, kind: STR }, required: ["project_id", "note"] },
    run: (a) => ric.memorySave({ projectId: a.project_id, projectName: a.project_name, note: a.note, kind: a.kind }),
  },
  {
    name: "project_memory_recall",
    description: "🗂️ Kliens-silózott projekt-memória előhívása egy projektre.",
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
  `RIC MCP szerver fut (stdio). Agy: ${ric.brainAvailable() ? "éles" : "demo"} | Elérés: ${ric.reachLiveAvailable() ? "firecrawl" : "szintetikus"} | ${TOOLS.length} tool.`
);
