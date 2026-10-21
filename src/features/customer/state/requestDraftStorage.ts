/**
 * RequestDraftStorage
 *
 * Keeps one unfinished request on the device, so closing the app does not throw
 * away what somebody typed.
 *
 * ⚠️ Feature-scoped and deliberately small. It stores a request draft, it does
 * not become the customer module's general storage: a wider surface is how the
 * next thing that "just needs saving" ends up here too.
 *
 * An interface with a swappable implementation, matching `OnboardingStorage` and
 * `SessionStorage`. No screen and no component ever sees the device, tests
 * never need it, and the day drafts live on the backend instead this is the only
 * file that changes. The device itself is reached through `core/storage`'s
 * `KeyValueStorage`, never AsyncStorage directly (CLAUDE.md section 4) — same
 * key, same JSON, so a draft saved before that move is still found. The class
 * keeps its name: AsyncStorage is still what lies underneath.
 *
 * ⚠️ Every failure is survivable and none of them is fatal. A draft that cannot
 * be read is treated as no draft; a draft that cannot be written leaves the
 * in-memory one untouched and the current session working normally. Losing the
 * ability to resume later is worth far less than interrupting somebody
 * mid-sentence to tell them about it.
 *
 * What is stored is one form's contents: a category, a service, a priority, a
 * preference, some image URLs and whatever the customer wrote about their own
 * problem. No credential, no session, no device information.
 *
 * ⚠️ It now also holds a service address, and where available the coordinates
 * behind it. That is the most sensitive thing in this file by some distance —
 * it is where somebody lives — so it is worth being explicit about the terms:
 * it is on this device only, it is never logged, it is written because the
 * customer asked for a professional to come to it, and it is deleted the moment
 * the request is sent. Nothing else about their location is kept.
 *
 * ⚠️ It belongs to one customer, and says which. A draft is written with the id
 * of the customer who was filling it in, and read back only for that customer:
 * one written by anybody else is discarded on sight. Logging out clears the draft
 * (Phase 3D-7), but a clear can fail, and a failed clear must never become the
 * next customer on this device being offered somebody else's address and notes.
 * The owner check is what makes that impossible rather than merely unlikely.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import type { RequestDraft } from '@/features/customer/state/requestDraft';

const log = createLogger('RequestDraftStorage');

/**
 * Bumped whenever `RequestDraft` changes shape.
 *
 * A draft written by an older build is discarded rather than migrated. It is one
 * unfinished form, and asking someone to fill it in again is a far smaller cost
 * than a migration nobody will maintain — or than a resumed draft that is
 * missing the field a screen now expects.
 *
 * Version 2 added the service address (PROJECT_BIBLE.md section 18). A version 1
 * draft is dropped rather than resumed with no address: it would restore into a
 * flow that now has a step it has never seen, and the customer would be asked
 * for an address on a request they thought was finished — which is a stranger
 * experience than starting again.
 *
 * Version 3 added the owner. A version 2 draft says nothing about whose it is,
 * so it cannot be handed to anyone safely and is dropped like any older one.
 */
const SCHEMA_VERSION = 3;

interface StoredDraft {
  version: number;
  savedAt: string;
  /** The customer who was filling it in, or null when there was no telling. */
  ownerId: string | null;
  draft: RequestDraft;
}

export interface SavedRequestDraft {
  draft: RequestDraft;
  /** ISO 8601, so the resume prompt can say how long ago it was started. */
  savedAt: string;
}

export interface RequestDraftStorage {
  /**
   * The saved draft, or null when there is none, when it cannot be read, or when
   * it was written for a different owner — which is also removed.
   */
  read(ownerId?: string | null): Promise<SavedRequestDraft | null>;
  /** Saves it as `ownerId`'s. Resolves false when the write failed. Never throws. */
  write(draft: RequestDraft, ownerId?: string | null): Promise<boolean>;
  clear(): Promise<void>;
}

/** Exported for its tests; the app reaches it through `getRequestDraftStorage`. */
export class AsyncStorageRequestDraft implements RequestDraftStorage {
  async read(ownerId: string | null = null): Promise<SavedRequestDraft | null> {
    try {
      const raw = await getKeyValueStorage().getItem(AppConfig.storage.requestDraftKey);
      if (!raw) {
        return null;
      }

      const stored = JSON.parse(raw) as Partial<StoredDraft>;

      if (stored.version !== SCHEMA_VERSION || !stored.draft) {
        // Written by a build that thought a draft was a different shape. Not an
        // error — just no longer resumable.
        log.info('Discarding a draft from an older schema', { version: stored.version });
        await this.clear();
        return null;
      }

      if ((stored.ownerId ?? null) !== ownerId) {
        /*
          Somebody else's. Never resumed, and removed so it cannot be offered
          to anyone later either: the customer who wrote it has signed out, and
          signing out is where their unsent draft was meant to end.
        */
        log.info('Discarding a draft written for another customer');
        await this.clear();
        return null;
      }

      return { draft: stored.draft, savedAt: stored.savedAt ?? new Date().toISOString() };
    } catch (error) {
      /*
        Unreadable or unparseable is treated as "no draft".

        The failure mode is a customer starting again, which is the same place
        they would be without this feature at all. Throwing would take the home
        screen down over an optional convenience.
      */
      log.error('Failed to read the request draft', { error: String(error) });
      return null;
    }
  }

  async write(draft: RequestDraft, ownerId: string | null = null): Promise<boolean> {
    try {
      const stored: StoredDraft = {
        version: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        ownerId,
        draft,
      };
      await getKeyValueStorage().setItem(
        AppConfig.storage.requestDraftKey,
        JSON.stringify(stored),
      );
      return true;
    } catch (error) {
      // The in-memory draft is untouched, so the request being filled in right
      // now is unaffected; only resuming it after a restart is lost.
      log.error('Failed to persist the request draft', { error: String(error) });
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await getKeyValueStorage().removeItem(AppConfig.storage.requestDraftKey);
    } catch (error) {
      /*
        A draft that cannot be removed is the one failure with a visible
        consequence: the home screen keeps offering to resume a request that has
        already been sent. It is logged loudly for that reason, but it still must
        not throw — the request itself succeeded, and that is what the customer
        is waiting to hear.
      */
      log.error('Failed to clear the request draft', { error: String(error) });
    }
  }
}

let requestDraftStorage: RequestDraftStorage = new AsyncStorageRequestDraft();

export function getRequestDraftStorage(): RequestDraftStorage {
  return requestDraftStorage;
}

/** Swaps the implementation. For tests, and for any future storage migration. */
export function setRequestDraftStorage(implementation: RequestDraftStorage): void {
  requestDraftStorage = implementation;
}
