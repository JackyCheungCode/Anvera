import type { PluginDescriptor } from "emdash";

export function anveraBusinessPlugin(): PluginDescriptor {
  return {
    id: "anvera-business",
    displayName: "ANVERA Business",
    description: "Inquiry and dealer operations for ANVERA.",
    version: "0.1.0",
    format: "native",
    entrypoint: "./src/plugins/anvera-business/runtime.ts",
    adminEntry: "./src/plugins/anvera-business/admin.tsx"
  };
}

export default anveraBusinessPlugin;
