import { linkedAccountsApi, usersApi } from "@/services/api";
import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";

const LINKED_SESSION_KEY = "linked_account_session";

export type LinkedSession = {
  userId: string;
  fullname: string;
  email: string;
  access_token: string;
  refresh_token: string;
};

export async function getLinkedSession(): Promise<LinkedSession | null> {
  const raw = await SecureStore.getItemAsync(LINKED_SESSION_KEY);
  return raw ? (JSON.parse(raw) as LinkedSession) : null;
}

async function setLinkedSession(session: LinkedSession | null) {
  if (session) {
    await SecureStore.setItemAsync(LINKED_SESSION_KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(LINKED_SESSION_KEY);
  }
}

/**
 * Verifies the target account's credentials and links it to the sup-member's
 * own account, without leaving the target account as the active session —
 * the owner's session is restored before any database write, since RLS on
 * `linked_accounts` requires `auth.uid() = owner_id`.
 */
export async function linkAccount(
  ownerId: string,
  email: string,
  password: string,
): Promise<void> {
  const { data: ownerSessionData } = await supabase.auth.getSession();
  const ownerSession = ownerSessionData.session;
  if (!ownerSession) throw new Error("Sesi kamu tidak ditemukan.");

  const { data: targetAuth, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !targetAuth.session || !targetAuth.user) {
    throw new Error("Email atau password akun tujuan salah.");
  }
  const targetSession = targetAuth.session;
  const targetUserId = targetAuth.user.id;

  const { error: restoreError } = await supabase.auth.setSession({
    access_token: ownerSession.access_token,
    refresh_token: ownerSession.refresh_token,
  });
  if (restoreError) throw restoreError;

  if (targetUserId === ownerId) {
    throw new Error("Tidak bisa menautkan akun ke akunmu sendiri.");
  }

  const { data: targetUserRow, error: targetUserError } =
    await usersApi.getById(targetUserId);
  if (targetUserError || !targetUserRow) {
    throw new Error("Akun tujuan tidak ditemukan.");
  }

  const { error: linkError } = await linkedAccountsApi.create({
    owner_id: ownerId,
    linked_user_id: targetUserId,
  });
  if (linkError) {
    if (linkError.code === "23505") {
      throw new Error(
        "Akun ini sudah tertaut ke akun lain, atau kamu sudah punya akun tertaut.",
      );
    }
    throw linkError;
  }

  await setLinkedSession({
    userId: targetUserId,
    fullname: targetUserRow.fullname,
    email: targetUserRow.email,
    access_token: targetSession.access_token,
    refresh_token: targetSession.refresh_token,
  });
}

/** Swaps the active client session with the one stored locally — no re-auth needed. */
export async function switchToLinkedAccount(currentUser: {
  id: string;
  fullname: string;
  email: string;
}): Promise<void> {
  const linked = await getLinkedSession();
  if (!linked) throw new Error("Tidak ada akun tertaut.");

  const { data: currentSessionData } = await supabase.auth.getSession();
  const currentSession = currentSessionData.session;
  if (!currentSession) throw new Error("Sesi kamu tidak ditemukan.");

  const { error } = await supabase.auth.setSession({
    access_token: linked.access_token,
    refresh_token: linked.refresh_token,
  });
  if (error) throw error;

  await setLinkedSession({
    userId: currentUser.id,
    fullname: currentUser.fullname,
    email: currentUser.email,
    access_token: currentSession.access_token,
    refresh_token: currentSession.refresh_token,
  });
}

/**
 * Logs out the currently active account. If a linked session is stored,
 * falls back to activating it instead of ending up at the login screen, and
 * dissolves the pairing (no tokens remain for the side that just logged out,
 * so leaving the `linked_accounts` row behind would only block re-linking).
 * Returns true when a fallback session was activated.
 */
export async function smartSignOut(currentUserId: string): Promise<boolean> {
  const linked = await getLinkedSession();
  if (!linked) {
    await supabase.auth.signOut();
    return false;
  }

  const { data: linkRow } = await linkedAccountsApi.getForUser(currentUserId);

  await supabase.auth.signOut();

  const { error } = await supabase.auth.setSession({
    access_token: linked.access_token,
    refresh_token: linked.refresh_token,
  });
  if (error) throw error;

  if (linkRow) await linkedAccountsApi.delete(linkRow.id);
  await setLinkedSession(null);
  return true;
}

/** Dissolves the pairing without signing anyone out. Callable from either linked side. */
export async function unlinkAccount(linkId: string): Promise<void> {
  const { error } = await linkedAccountsApi.delete(linkId);
  if (error) throw error;
  await setLinkedSession(null);
}

/**
 * On a fresh login, deletes a stale `linked_accounts` row when this device
 * has no local session for the paired account. Only acts on the `owner_id`
 * side: the linked/secondary account's owner is the only one who ever gets a
 * `LinkedSession` written to this device (see `linkAccount`), so a normal
 * login by the linked user — who never has one by design — must not be
 * mistaken for a stale link. Any inconclusive signal (network/query error,
 * SecureStore failure) is treated as "don't know" and left untouched, never
 * as a confirmed absence.
 */
export async function checkAndAutoUnlink(userId: string): Promise<void> {
  const { data: linkRow, error } = await linkedAccountsApi.getForUser(userId);
  if (error || !linkRow || linkRow.owner_id !== userId) return;

  let session: LinkedSession | null;
  try {
    session = await getLinkedSession();
  } catch {
    return;
  }
  if (session === null) {
    await linkedAccountsApi.delete(linkRow.id);
  }
}
