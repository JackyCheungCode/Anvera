import astroWorker from "../dist/_worker.js/index.js";
import { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

export { PluginBridge };

export default {
  ...astroWorker,
  scheduled: createScheduledHandler()
} satisfies ExportedHandler;
