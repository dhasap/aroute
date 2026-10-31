import { NextResponse } from "next/server";
import { getCombos, createCombo, getComboByName } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// GET /api/combos - Get all combos
export async function GET() {
  try {
    const combos = await getCombos();
    return NextResponse.json({ combos });
  } catch (error) {
    console.log("Error fetching combos:", error);
    return NextResponse.json({ error: "Failed to fetch combos" }, { status: 500 });
  }
}

// POST /api/combos - Create new combo
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, models, kind, contextWindow, systemPrompt } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Validate name format
    if (!VALID_NAME_REGEX.test(name)) {
      return NextResponse.json({ error: "Name can only contain letters, numbers, -, _ and ." }, { status: 400 });
    }

    // Validate context window if provided (null/undefined = auto)
    if (contextWindow !== null && contextWindow !== undefined && contextWindow !== "") {
      const n = Number(contextWindow);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        return NextResponse.json({ error: "Context window must be a positive whole number" }, { status: 400 });
      }
    }

    // Validate system prompt if provided (string or null/undefined; length cap 64KB)
    if (systemPrompt !== null && systemPrompt !== undefined && systemPrompt !== "") {
      if (typeof systemPrompt !== "string") {
        return NextResponse.json({ error: "System prompt must be a string" }, { status: 400 });
      }
      if (systemPrompt.length > 65536) {
        return NextResponse.json({ error: "System prompt too long (max 65536 chars)" }, { status: 400 });
      }
    }

    // Check if name already exists
    const existing = await getComboByName(name);
    if (existing) {
      return NextResponse.json({ error: "Combo name already exists" }, { status: 400 });
    }

    const combo = await createCombo({ name, models: models || [], kind: kind || null, contextWindow, systemPrompt });

    return NextResponse.json(combo, { status: 201 });
  } catch (error) {
    console.log("Error creating combo:", error);
    return NextResponse.json({ error: "Failed to create combo" }, { status: 500 });
  }
}
