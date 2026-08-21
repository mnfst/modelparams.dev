import path from "node:path";
import ejs from "ejs";
import { MCP_CLIENTS, MCP_TOOLS } from "../data/mcp.js";
import { VIEWS_DIR } from "../data/paths.js";
import { SITE_NAME, SITE_URL } from "../data/site.js";
import { MCP_PATH, absolute, ogImagePath } from "../data/urls.js";
import { type Model } from "../schema/model.js";
import { jsonBlock } from "./highlight.js";
import { hubLinks, renderShell, viewHelpers } from "./render.js";

const MCP_TITLE = `MCP server · ${SITE_NAME}`;
const MCP_DESCRIPTION =
  "A Model Context Protocol server for the modelparams.dev catalog — let a coding agent check which parameters a model accepts before it calls one.";

export async function renderMcpPage(allModels: Model[]): Promise<string> {
  const body = await ejs.renderFile(path.join(VIEWS_DIR, "mcp.ejs"), {
    clients: MCP_CLIENTS,
    tools: MCP_TOOLS,
    jsonBlock,
    helpers: viewHelpers,
  });

  return renderShell(
    {
      title: MCP_TITLE,
      description: MCP_DESCRIPTION,
      canonicalUrl: absolute(SITE_URL, MCP_PATH),
      ogImage: ogImagePath(MCP_PATH),
      structuredData: "{}",
      providerHubs: hubLinks(allModels),
    },
    body,
  );
}
