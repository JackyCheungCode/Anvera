import type { PluginDescriptor } from "emdash";

export function anveraBusinessPlugin(): PluginDescriptor {
  return {
    id: "anvera-business",
    displayName: "ANVERA Business",
    description: "ANVERA business operations and Product Intelligence workspace.",
    version: "0.1.0",
    format: "native",
    entrypoint: "./src/plugins/anvera-business/runtime.ts",
    adminEntry: "./src/plugins/anvera-business/admin.tsx"
  };
}

export default anveraBusinessPlugin;
