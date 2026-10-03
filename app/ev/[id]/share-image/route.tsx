import { ImageResponse } from "next/og";
import { CARD_HEADERS, CARD_SIZE, Frame, MUTED, Tile } from "@/components/ShareCard";
import { getBackupPower, getFederalData, getUtilities, getVehicles } from "@/lib/data";
import { vehicleCardFacts } from "@/lib/vehicleCard";

// The preview image for a vehicle guide page (/ev/<id>): the page's headline
// figures — range, cost per 100 miles against gas, backup power — from the
// same helpers the page uses. Drawn on request (not at build) in the Node
// runtime, since it reads the data files; cached for a day.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const evs = getVehicles();
  const v = evs.find((x) => x.id === id);
  if (!v) return new Response("Not found", { status: 404 });
  const f = vehicleCardFacts(v, getFederalData(), getUtilities(), evs, getBackupPower());
  return new ImageResponse(
    (
      <Frame kicker="Vehicle guide · West Virginia" path={f.path} footer="Typical WV commuter on Appalachian Power, winter included">
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
          <div style={{ fontSize: f.title.length > 30 ? 48 : 56, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{f.title}</div>
          <div style={{ fontSize: 26, color: MUTED, marginTop: 10 }}>{f.subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 30 }}>
          {f.tiles.map((t) => <Tile key={t.label} label={t.label} value={t.value} sub={t.sub} />)}
        </div>
        {f.note && <div style={{ display: "flex", marginTop: 30, fontSize: 24, color: MUTED, lineHeight: 1.3 }}>{f.note}</div>}
      </Frame>
    ),
    { ...CARD_SIZE, headers: CARD_HEADERS },
  );
}
