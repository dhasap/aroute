import { NextResponse } from "next/server";
import { FILTERS, onlyFree } from "./filters.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const type = searchParams.get("type");
  // freeOnly=1 narrows the filtered result to free models only (the detail
  // page sends it while the "Free only" toggle is checked).
  const freeOnly = searchParams.get("freeOnly") === "1";

  if (!url || !type) {
    return NextResponse.json({ error: "Missing url or type" }, { status: 400 });
  }

  const filter = FILTERS[type];
  if (!filter) {
    return NextResponse.json({ error: "Unknown filter type" }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }
    const json = await res.json();
    const raw = json.data ?? json.models ?? json;
    let data = filter(Array.isArray(raw) ? raw : []);
    if (freeOnly) data = onlyFree(data);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
