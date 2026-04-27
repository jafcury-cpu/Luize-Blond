// Cloud-side persistence for the realtime toast severity preference.
// Mirrors the value into `settings.realtime_toast_severity` so the choice
// follows the user across devices (in addition to the local-storage cache
// used by chat-preferences.ts for instant reads / offline fallback).

import { supabase } from "@/integrations/supabase/client";
import {
  REALTIME_TOAST_SEVERITIES,
  type RealtimeToastSeverity,
} from "@/lib/chat-preferences";

function isValidSeverity(value: unknown): value is RealtimeToastSeverity {
  return typeof value === "string" && (REALTIME_TOAST_SEVERITIES as string[]).includes(value);
}

/** Fetch the user's saved severity from the cloud. Returns null on miss/error. */
export async function fetchRealtimeToastSeverityFromCloud(
  userId: string,
): Promise<RealtimeToastSeverity | null> {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("realtime_toast_severity")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    const value = (data as { realtime_toast_severity?: unknown } | null)?.realtime_toast_severity;
    return isValidSeverity(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Persist the severity in the cloud for the given user. Uses upsert so a row
 * is created on first save without overwriting other settings columns.
 */
export async function pushRealtimeToastSeverityToCloud(
  userId: string,
  severity: RealtimeToastSeverity,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("settings")
      .upsert(
        { user_id: userId, realtime_toast_severity: severity },
        { onConflict: "user_id" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
