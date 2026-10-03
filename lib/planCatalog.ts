// The catalog the planner and its share-card image run on. Server-only: it
// reads data/* through lib/data.ts. Long free-text fields are dropped so the
// page stays light on phones; the engine never reads them.

import { getBackupPower, getFederalData, getIceVehicles, getOwnershipAssumptions, getUtilities, getVehicles } from "./data";
import type { Features } from "./features";
import type { Catalog } from "./household";

// The planner shows equipment yes/no only; the long research notes stay on /ev.
const slim = (f?: Features): Features | undefined => (f ? { ...f, note: undefined, source: undefined } : undefined);

export function planCatalog(): Catalog {
  return {
    evs: getVehicles().map((v) => ({ ...v, notes: "", capability_note: undefined, capability_source: undefined, features: slim(v.features) })),
    ice: getIceVehicles().map((v) => ({ ...v, capability_note: undefined, capability_source: undefined, price_note: undefined, features: slim(v.features) })),
    utilities: getUtilities(),
    fed: getFederalData(),
    own: getOwnershipAssumptions(),
    backup: getBackupPower(),
  };
}
