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

function ocmUrl(): string {
  const base = `https://api.openchargemap.io/v3/poi?output=json&countrycode=US&boundingbox=${WV_BBOX}&maxresults=2000&compact=true&verbose=false`;
  const key = process.env.OPENCHARGEMAP_API_KEY;
  return key ? `${base}&key=${encodeURIComponent(key)}` : base;
}

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

function normalizeConnector(title: string | undefined): NormalizedConnectorType {
  if (!title) return "Other";
  const t = title.toLowerCase();
  if (t.includes("ccs")) return "CCS";
  if (t.includes("nacs") || t.includes("north american charging")) return "NACS";
  if (t.includes("chademo")) return "CHAdeMO";
  if (t.includes("tesla")) return "Tesla";
  if (t.includes("j1772") || t.includes("type 1")) return "J1772";
  return "Other";
}

function transformPoi(poi: OcmPoi): Charger | null {
  const addr = poi.AddressInfo;
  if (!addr || addr.Latitude == null || addr.Longitude == null) return null;

  const connectors: ChargerConnector[] = (poi.Connections ?? []).map((c) => ({
    type: normalizeConnector(c.ConnectionType?.Title),
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
    ocm_url: `https://openchargemap.org/site/poi/details/${poi.ID}`,
  };
}

export async function getChargers(): Promise<{
  chargers: Charger[];
  retrieved_at: string;
  error: string | null;
}> {
  const retrieved_at = new Date().toISOString().slice(0, 10);
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
      // Revalidate once per day if the route becomes ISR later; no effect at build time.
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      const suffix =
        res.status === 403 && !hasKey
          ? " — set OPENCHARGEMAP_API_KEY env var (free at openchargemap.org/profile/register)"
          : "";
      return {
        chargers: [],
        retrieved_at,
        error: `OpenChargeMap returned ${res.status}${suffix}`,
      };
    }
    const data = (await res.json()) as OcmPoi[];
    const chargers = data
      .map(transformPoi)
      .filter((c): c is Charger => c !== null);
    return { chargers, retrieved_at, error: null };
  } catch (e) {
    return {
      chargers: [],
      retrieved_at,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
