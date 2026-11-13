import type { APIRoute } from "astro";

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" }
  });

const clean = (value: unknown, max = 120) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const type = clean(body.type, 12);
  const countryCode = clean(body.countryCode, 2).toUpperCase();
  const countryInput = clean(body.country, 120);
  const state = clean(body.state, 120);
  if (!["states", "cities"].includes(type) || !/^[A-Z]{2}$/.test(countryCode)) {
    return json({ ok: false, error: "invalid_location_request" }, 422);
  }

  const country = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryInput;
  if (!country || country === countryCode || (type === "cities" && !state)) {
    return json({ ok: false, error: "incomplete_location" }, 422);
  }

  const endpoint = type === "states"
    ? "https://countriesnow.space/api/v0.1/countries/states"
    : "https://countriesnow.space/api/v0.1/countries/state/cities";

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(type === "states" ? { country } : { country, state }),
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) return json({ ok: false, error: "location_provider_unavailable" }, 502);
    const payload = await upstream.json() as any;
    if (payload?.error) return json({ ok: false, error: "location_data_unavailable" }, 502);

    if (type === "states") {
      const rows = Array.isArray(payload?.data?.states) ? payload.data.states : [];
      const regionNames: string[] = rows
        .map((item: unknown): string =>
          typeof item === "string" ? item.trim() : clean((item as { name?: unknown })?.name)
        )
        .filter((value: string): value is string => Boolean(value));
      const regions: string[] = Array.from(new Set<string>(regionNames))
        .sort((a: string, b: string) => a.localeCompare(b));
      return json({ ok: true, countryCode, country, regions });
    }

    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const cityNames: string[] = rows
      .map((item: unknown): string =>
        typeof item === "string" ? item.trim() : clean((item as { name?: unknown })?.name)
      )
      .filter((value: string): value is string => Boolean(value));
    const cities: string[] = Array.from(new Set<string>(cityNames))
      .sort((a: string, b: string) => a.localeCompare(b));
    return json({ ok: true, countryCode, country, state, cities });
  } catch {
    return json({ ok: false, error: "location_provider_unavailable" }, 502);
  }
};
