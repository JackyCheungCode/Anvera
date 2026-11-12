import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";
import { handleVehicleCatalogRequest, handleVehicleFitmentRequest, type VehicleFitmentEnv } from "./lib/vehicle-fitment-api";
import { handleConfigurationOrdersRequest, handleConfigurationOrderGetRequest, type ConfigurationOrderEnv } from "./lib/configuration-orders-api";

export { PluginBridge };

type WorkerFetch = (request: Request, env: unknown, ctx: ExecutionContext) => Response | Promise<Response>;
const emdashFetch = handler.fetch as unknown as WorkerFetch;

export default {
  ...handler,
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const pathname = new URL(request.url).pathname;
    const vehicleEnv = env as VehicleFitmentEnv;

    if (pathname === "/api/configuration-orders") {
      if (request.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "POST", "Cache-Control": "no-store" }
      });
      return handleConfigurationOrdersRequest(request, env as ConfigurationOrderEnv);
    }

    const orderMatch = pathname.match(/^\\/api\\/configuration-orders\\/([^/]+)$/);
    if (orderMatch) {
      if (request.method !== "GET") return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "GET", "Cache-Control": "no-store" }
      });
      return handleConfigurationOrderGetRequest(request, env as ConfigurationOrderEnv, decodeURIComponent(orderMatch[1]));
    }

    if (pathname === "/vehicle-fitment/catalog") {
      if (request.method !== "GET") return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "GET", "Cache-Control": "no-store" }
      });
      return handleVehicleCatalogRequest(request, vehicleEnv);
    }

    if (pathname === "/vehicle-fitment/search") {
      if (request.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "POST", "Cache-Control": "no-store" }
      });
      return handleVehicleFitmentRequest(request, vehicleEnv);
    }

    return emdashFetch(request, env, ctx);
  },
  scheduled: createScheduledHandler()
} satisfies ExportedHandler;
