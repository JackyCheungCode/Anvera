import { definePlugin } from "emdash";

export function createPlugin() {
  return definePlugin({
    id: "anvera-business",
    displayName: "ANVERA Business",
    description: "Business operations workspace for inquiries and dealer accounts.",
    version: "0.1.0",
    capabilities: [],
    routes: {}
  });
}

export default createPlugin;
