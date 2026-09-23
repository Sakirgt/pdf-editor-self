import { supabase } from "@/lib/supabase/client";

export const GUEST_EDIT_LIMIT = 3;
const GUEST_STORAGE_KEY = "docuconvert_guest_edits";

export function getGuestEditCount(): number {
  if (typeof window === "undefined") return 0;
  const val = localStorage.getItem(GUEST_STORAGE_KEY);
  return val ? parseInt(val, 10) || 0 : 0;
}

export function incrementGuestEditCount(): number {
  if (typeof window === "undefined") return 0;
  const current = getGuestEditCount();
  const next = current + 1;
  localStorage.setItem(GUEST_STORAGE_KEY, next.toString());
  window.dispatchEvent(new CustomEvent("edit-count-changed", { detail: { count: next, isGuest: true } }));
  return next;
}

export function hasReachedGuestLimit(): boolean {
  return getGuestEditCount() >= GUEST_EDIT_LIMIT;
}

export async function getUserEditCount(userId: string): Promise<number> {
  if (typeof window === "undefined") return 0;
  
  // 1. Instant read from local cache
  const localVal = localStorage.getItem(`docuconvert_user_edits_${userId}`);
  const cachedCount = localVal ? parseInt(localVal, 10) || 0 : 0;

  // 2. Fetch from Supabase user_metadata to sync
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId) {
      const serverCount = user.user_metadata?.pdf_edits_count;
      if (typeof serverCount === "number") {
        const finalCount = Math.max(cachedCount, serverCount);
        localStorage.setItem(`docuconvert_user_edits_${userId}`, finalCount.toString());
        return finalCount;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch user metadata from Supabase:", err);
  }

  return cachedCount;
}

export async function incrementUserEditCount(userId: string): Promise<number> {
  if (typeof window === "undefined") return 0;

  const current = await getUserEditCount(userId);
  const next = current + 1;

  // Update local cache immediately
  localStorage.setItem(`docuconvert_user_edits_${userId}`, next.toString());
  window.dispatchEvent(new CustomEvent("edit-count-changed", { detail: { count: next, isGuest: false, userId } }));

  // Update Supabase user metadata asynchronously
  try {
    await supabase.auth.updateUser({
      data: {
        pdf_edits_count: next,
      },
    });
  } catch (err) {
    console.warn("Failed to sync edit count to Supabase user metadata:", err);
  }

  return next;
}
