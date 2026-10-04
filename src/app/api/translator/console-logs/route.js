import { NextResponse } from "next/server";
import { clearConsoleLogs, getConsoleLogs, initConsoleLogCapture } from "@/lib/consoleLogBuffer";

// The buffer is per-process and changes every second; never let Next bake a
// snapshot of this into the build or the polling client reads stale logs.
export const dynamic = "force-dynamic";

initConsoleLogCapture();

export async function GET() {
  try {
    const logs = getConsoleLogs();
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Error getting console logs:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearConsoleLogs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing console logs:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
