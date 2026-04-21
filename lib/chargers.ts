// Server-side OpenChargeMap fetch for the /chargers page.
// Runs at build time; redeploys refresh the data. Falls back to an empty
// list on fetch failure so a transient OCM outage doesn't break the build.

export interface ChargerConnector {
  type: NormalizedConnectorType;
  power_kw: number | null;
  is_dcfc: boolean;
  quantity: number;
}

export type NormalizedConnectorType =
  | "CCS"
  | "NACS"
  | "CHAdeMO"
  | "J1772"
  | "Tesla"
  | "Other";

export interface Charger {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string;
  town: string;
  state: string;
  operator: string | null;
  connectors: ChargerConnector[];
  max_power_kw: number;
  is_dcfc: boolean;
  connector_types: NormalizedConnectorType[];
  ocm_url: string;
}

// West Virginia + small buffer for border-crossing chargers.
// Format: (SW lat,lng),(NE lat,lng)
const WV_BBOX = "(37.0,-82.9),(40.9,-77.5)";

// We deliberately DON'T set compact=true: that flag strips the nested
// ConnectionType.Title and OperatorInfo.Title objects, leaving only numeric
// IDs. We need the titles both for connector-type normalization and for the
// popup UI. Response size at WV scale is ~3-5 MB, fetched once per build —
// fine.
function ocmUrl(): string {
  const base = `https://api.openchargemap.io/v3/poi?output=json&countrycode=US&boundingbox=${WV_BBOX}&maxresults=2000&verbose=false`;
  const key = process.env.OPENCHARGEMAP_API_KEY;
  return key ? `${base}&key=${encodeURIComponent(key)}` : base;
}

// OCM ConnectionTypeID → our categories. Defensive fallback for when Title
// isn't present. OCM's reference IDs have been reshuffled over time; values
// below reflect the April 2026 reference data
// (api.openchargemap.io/v3/referencedata/). Title-based matching in
// normalizeConnector is the primary path — this fallback only fires when
// the Title is missing or unfamiliar.
const CONNECTOR_TYPE_ID: Record<number, NormalizedConnectorType> = {
  1: "J1772",       // Type 1 (J1772)
  2: "CHAdeMO",
  7: "Tesla",       // Tesla (Roadster — US pre-NACS)
  8: "Tesla",       // Tesla (Model S/X — legacy US pre-NACS)
  25: "J1772",      // Type 2 (Mennekes) — treated as L2 here
  27: "NACS",       // NACS / Tesla Supercharger (current OCM mapping)
  30: "Tesla",      // Tesla Supercharger (older OCM naming)
  32: "CCS",        // CCS (Type 1 / SAE Combo)
  33: "CCS",        // CCS (Type 2 / European Combo)
  50: "NACS",       // NACS (alternate OCM mapping)
};

interface OcmConnection {
  ConnectionTypeID?: number;
  ConnectionType?: { Title?: string };
  Level?: { IsFastChargeCapable?: boolean };
  PowerKW?: number | null;
  Quantity?: number | null;
}

interface OcmPoi {
  ID: number;
  AddressInfo?: {
    Title?: string;
    AddressLine1?: string;
    Town?: string;
    StateOrProvince?: string;
    Latitude?: number;
    Longitude?: number;
  };
  OperatorInfo?: { Title?: string };
  Connections?: OcmConnection[];
}

function normalizeConnector(
  title: string | undefined,
  typeId: number | undefined,
): NormalizedConnectorType {
  if (title) {
    const t = title.toLowerCase();
    // Check NACS before CCS — "NACS" doesn't contain "ccs" but Tesla's unified
    // naming "NACS / Tesla" shouldn't be mistaken for CCS either.
    if (t.includes("nacs") || t.includes("north american charging")) return "NACS";
    if (t.includes("ccs")) return "CCS";
    if (t.includes("chademo")) return "CHAdeMO";
    if (t.includes("tesla")) return "Tesla";
    if (t.includes("j1772") || t.includes("type 1")) return "J1772";
    if (t.includes("type 2") || t.includes("mennekes")) return "J1772";
  }
  // Fallback to ID mapping if title is missing or unrecognized
  if (typeId != null && CONNECTOR_TYPE_ID[typeId]) return CONNECTOR_TYPE_ID[typeId];
  return "Other";
}

function transformPoi(poi: OcmPoi): Charger | null {
  const addr = poi.AddressInfo;
  if (!addr || addr.Latitude == null || addr.Longitude == null) return null;

  const connectors: ChargerConnector[] = (poi.Connections ?? []).map((c) => ({
    type: normalizeConnector(c.ConnectionType?.Title, c.ConnectionTypeID),
    power_kw: c.PowerKW ?? null,
    is_dcfc: c.Level?.IsFastChargeCapable === true || (c.PowerKW ?? 0) > 22,
    quantity: c.Quantity ?? 1,
  }));

  const max_power_kw = connectors.reduce(
    (max, c) => (c.power_kw != null && c.power_kw > max ? c.power_kw : max),
    0,
  );
  const is_dcfc = connectors.some((c) => c.is_dcfc);
  const connector_types = Array.from(
    new Set(connectors.map((c) => c.type)),
  ) as NormalizedConnectorType[];

  return {
    id: poi.ID,
    name: addr.Title ?? "Unnamed station",
    lat: addr.Latitude,
    lng: addr.Longitude,
    address: addr.AddressLine1 ?? "",
    town: addr.Town ?? "",
    state: addr.StateOrProvince ?? "",
    operator: poi.OperatorInfo?.Title ?? null,
    connectors,
    max_power_kw,
    is_dcfc,
    connector_types,
    // OpenChargeMap's main site (openchargemap.org/site/poi/...) now gates POI
    // detail pages behind login, and their SPA's hash-based deep-linking on
    // map.openchargemap.io doesn't reliably populate a station view. The
    // coordinate-based URL *does* reliably center their map on the station
    // — OCM's own pin shows up at the center at zoom 17 and the user can
    // click it in OCM's UI for full details. id is passed too, in case
    // their router ever starts honouring it.
    ocm_url: `https://map.openchargemap.io/?latitude=${addr.Latitude}&longitude=${addr.Longitude}&zoom=17&id=${poi.ID}`,
  };
}

// Fallback snapshot shape. Committed alongside the code at
// data/charger-snapshot.json so a failing build still produces a working
// charger map instead of the "data temporarily unavailable" UI. Refreshed
// quarterly (or any time we notice the live data has drifted meaningfully).
interface ChargerSnapshot {
  retrieved_at: string;
  source?: string;
  notes?: string;
  pois: OcmPoi[];
}

async function tryLiveFetch(): Promise<
  { ok: true; pois: OcmPoi[] } | { ok: false; error: string; status?: number }
> {
  const hasKey = !!process.env.OPENCHARGEMAP_API_KEY;
  try {
    const headers: Record<string, string> = {
      "User-Agent": "GoEV-WV/1.1 (goevwv.com)",
    };
    if (hasKey) {
      headers["x-api-key"] = process.env.OPENCHARGEMAP_API_KEY!;
    }
    const res = await fetch(ocmUrl(), {
      headers,
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      const suffix =
        res.status === 403 && !hasKey
          ? " — set OPENCHARGEMAP_API_KEY env var (free at openchargemap.org/profile/register)"
          : "";
      return {
        ok: false,
        status: res.status,
        error: `OpenChargeMap returned ${res.status}${suffix}`,
      };
    }
    const data = (await res.json()) as OcmPoi[];
    return { ok: true, pois: data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

async function loadSnapshot(): Promise<ChargerSnapshot | null> {
  // Dynamic import so this module stays edge-safe if ever used in an edge
  // context — fs only loads on the Node server. At build time it's a regular
  // Node process, so this is a no-op.
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const path = join(process.cwd(), "data", "charger-snapshot.json");
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as ChargerSnapshot;
  } catch {
    return null;
  }
}

export async function getChargers(): Promise<{
  chargers: Charger[];
  retrieved_at: string;
  error: string | null;
  is_snapshot?: boolean;
  snapshot_date?: string;
}> {
  const today = new Date().toISOString().slice(0, 10);

  // Retry the live fetch 2-3 times with a short backoff. OpenChargeMap's
  // free-tier rate limits can briefly return 403/429 and then recover a
  // second later. Without retries, any such blip would bake the fallback
  // error into the static build for a full deploy cycle.
  let lastError = "Unknown fetch failure";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await tryLiveFetch();
    if (result.ok) {
      const chargers = result.pois
        .map(transformPoi)
        .filter((c): c is Charger => c !== null);
      return { chargers, retrieved_at: today, error: null };
    }
    lastError = result.error;
    if (attempt < 3) {
      // 800 ms, then 2 s. Keeps total worst-case latency under 3 s while
      // covering typical transient-rate-limit windows.
      await new Promise((r) => setTimeout(r, attempt === 1 ? 800 : 2000));
    }
  }

  // All live attempts failed — try the committed snapshot. Users see real
  // charger data (slightly stale) instead of a blank map + error banner.
  const snapshot = await loadSnapshot();
  if (snapshot?.pois) {
    const chargers = snapshot.pois
      .map(transformPoi)
      .filter((c): c is Charger => c !== null);
    return {
      chargers,
      retrieved_at: snapshot.retrieved_at,
      error: null,
      is_snapshot: true,
      snapshot_date: snapshot.retrieved_at,
    };
  }

  // Live failed AND no snapshot available — fall back to the empty-state UI.
  return {
    chargers: [],
    retrieved_at: today,
    error: lastError,
  };
}
