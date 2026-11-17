/**
 * RequestDraftContext
 *
 * The one request a customer is part-way through, and the only thing that
 * remembers it.
 *
 * ⚠️ It exists because request creation is not one screen. PROJECT_BIBLE.md
 * section 13 runs details → vendor selection → confirmation, so the answers are
 * collected across three screens and sent from the last, and something has to
 * hold them in between.
 *
 * Not navigation params. The draft holds the customer's own words and the URLs
 * of photographs of their home; navigation state is serialised, logged by
 * devtools and restored from disk, which is no place for either. Params carry
 * flow identifiers and nothing else.
 *
 * Not Redux. A half-finished request is not application state other modules
 * read — it has exactly one reader, and putting it in the store would make every
 * screen able to see and change it.
 *
 * ⚠️ It **is** persisted, and that is a deliberate reversal. This context used to
 * say a draft must not outlive the flow, on the grounds that an abandoned one
 * restored later is a request nobody meant to send. The product owner's answer
 * is that a customer who filled in a form and took a phone call should not lose
 * it — so the draft survives, and the protection against sending it by accident
 * is that resuming only ever puts them back on the screen they left, never past
 * it. Nothing is submitted without somebody pressing Submit on a summary of it.
 *
 * One draft. A customer is filling in one request; entering the flow again
 * continues the same draft rather than starting a second, so there is nothing to
 * manage and nothing to choose between.
 *
 * ⚠️ It also holds what the last submission produced, and only until the app
 * closes. That is not scope creep into a second store: destroying the draft and
 * recording what it became are the same event, and splitting them across two
 * owners is how the home screen ends up offering to resume a request that has
 * already been sent. See `recordSubmission`.
 *
 * ⚠️ One customer's. The provider is told who is signed in (`ownerId`), writes
 * the draft as theirs and restores only a draft that is theirs, so a second
 * customer on the same device is never offered the first one's unsent request
 * — even when the clear at logout failed (Phase 3D-7).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import { createLogger } from '@/core/logger/Logger';

import {
  completionOf,
  isDraftWorthKeeping,
  NO_VENDOR_CHOICE,
  type RequestDraft,
  type RequestDraftCompletion,
  type SubmittedRequest,
} from '@/features/customer/state/requestDraft';
import { getRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';

export type { RequestDraft } from '@/features/customer/state/requestDraft';

interface RequestDraftContextValue {
  draft: RequestDraft | null;
  /**
   * False until the saved draft has been looked for.
   *
   * Home waits on it rather than guessing: offering to resume a request only
   * after storage has answered is the difference between an absent prompt and
   * one that flickers into existence a moment after the screen has been read.
   */
  isRestored: boolean;
  /** When the draft was last written, for the resume prompt. */
  savedAt: string | null;
  /** How far along the draft is, computed in one place for every screen. */
  completion: RequestDraftCompletion | null;
  /** Starts or replaces the draft. Entering the details screen anew does this. */
  startDraft: (draft: RequestDraft) => void;
  /** Merges into the existing draft, leaving every other answer alone. */
  updateDraft: (changes: Partial<RequestDraft>) => void;
  /**
   * Takes a professional the latest eligible list no longer has off the draft,
   * leaving the vendor question unanswered (PROJECT_BIBLE.md section 18A;
   * Phase 3D-12). Only that professional: a draft that names somebody else by
   * now is left alone. Called by `useCheckedVendorChoice`, never on a guess.
   */
  withdrawVendor: (vendorId: string) => void;
  /**
   * True once `withdrawVendor` has taken a professional off, until the vendor
   * question is answered again or the draft is replaced or sent.
   *
   * ⚠️ Here rather than on Preferred Vendor, because the confirmation screen
   * can be the one that finds them gone, and it then goes back: the screen
   * that says so is not the one that saw it. In memory only — after a restart
   * the question is simply unanswered.
   */
  isVendorWithdrawn: boolean;
  /**
   * Forgets it, here and on the device.
   *
   * A sent request does this through `recordSubmission`; the only other caller
   * is logging out, which awaits the result so the device copy is gone before
   * the session is. Resolves either way — a removal that fails is logged, and
   * the owner check is what keeps that draft from anyone else.
   */
  clearDraft: () => Promise<void>;

  /**
   * What the last submission produced, or null when nothing has been sent.
   *
   * ⚠️ In memory only. A draft is written down because there is something left
   * to finish; a sent request has nothing left to do, so this deliberately does
   * not survive the app being closed — reopening on a success screen for a
   * request sent yesterday would be a stranger thing than opening on Home.
   */
  submitted: SubmittedRequest | null;

  /**
   * Records a sent request and forgets the draft that became it.
   *
   * ⚠️ One action rather than two, because they are one event. Clearing the
   * draft and remembering what it turned into happen at the same instant, and a
   * caller that could do one without the other is a caller that can leave the
   * home screen offering to resume a request that has already gone out.
   *
   * Only a confirmed success may call it. Nothing here checks that — the check
   * belongs at the call site, which is the only place that has the service's
   * answer to look at.
   */
  recordSubmission: (submission: SubmittedRequest) => void;
}

const log = createLogger('RequestDraftContext');

/** Whether the draft names this professional — the only one `withdrawVendor` may take off. */
function namesVendor(draft: RequestDraft | null, vendorId: string): draft is RequestDraft {
  return draft !== null && draft.vendor.kind === 'vendor' && draft.vendor.vendorId === vendorId;
}

const RequestDraftContext = createContext<RequestDraftContextValue | undefined>(undefined);

export interface RequestDraftProviderProps {
  /**
   * The signed-in customer the draft belongs to.
   *
   * Read once, when the provider mounts. It never changes underneath one:
   * signing out unmounts the customer application, provider and all, and the
   * next customer gets a provider of their own.
   */
  ownerId?: string | null;
}

export function RequestDraftProvider({
  children,
  ownerId = null,
}: PropsWithChildren<RequestDraftProviderProps>) {
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedRequest | null>(null);
  const [isVendorWithdrawn, setIsVendorWithdrawn] = useState(false);

  /*
    ⚠️ The draft as of the last change asked for, ahead of the render that
    shows it — set together with the state by `commitDraft`, and only there.

    Every action decides from this and writes the result down beside the
    update, never inside a state updater: React may run an updater during
    render and runs it twice under StrictMode, so a write inside one could go
    out twice (found in review, 3D-12). Read from the ref rather than from the
    `draft` a callback closes over, because two changes in the same tick — a
    form writing two answers in one handler — must compose: the second sees the
    first, as it did when each was a functional update.
  */
  const draftRef = useRef<RequestDraft | null>(null);
  const commitDraft = useCallback((next: RequestDraft | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const ownerRef = useRef(ownerId);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
    Read once, on the way in.

    A draft that cannot be read comes back as none, which leaves the customer
    exactly where they would be without this feature — starting again — rather
    than looking at a home screen that failed to load over an optional
    convenience.
  */
  useEffect(() => {
    void (async () => {
      /*
        Guarded even though the implementation promises not to throw.

        The promise belongs to one implementation; the provider depends on the
        interface, and the day a second one is written the customer's home screen
        must not be what discovers it throws. `isRestored` is set either way, or a
        failed read would leave Home waiting for an answer that never comes.
      */
      let saved = null;
      try {
        saved = await getRequestDraftStorage().read(ownerRef.current);
      } catch (error) {
        log.error('Could not restore the request draft', { error: String(error) });
      }

      if (!mountedRef.current) {
        return;
      }

      if (saved) {
        commitDraft(saved.draft);
        setSavedAt(saved.savedAt);
      }
      setIsRestored(true);
    })();
  }, [commitDraft]);

  /**
   * Writes, and says nothing when it fails.
   *
   * The in-memory draft is already updated by the time this runs, so a failed
   * write costs only the ability to resume after a restart. Interrupting someone
   * mid-form to report that would trade a real interruption for a hypothetical
   * loss; the failure is logged where a developer will see it.
   */
  const persist = useCallback((next: RequestDraft) => {
    void getRequestDraftStorage()
      .write(next, ownerRef.current)
      .then(written => {
        if (written && mountedRef.current) {
          setSavedAt(new Date().toISOString());
        }
      })
      .catch(error => {
        log.error('Could not persist the request draft', { error: String(error) });
      });
  }, []);

  /**
   * Removes it from the device, and shrugs if it cannot.
   *
   * The consequence of a failed removal is visible — Home keeps offering a
   * request that has already been sent — but the request itself succeeded, and
   * that is what the customer is waiting to hear.
   */
  const forget = useCallback(
    (): Promise<void> =>
      getRequestDraftStorage()
        .clear()
        .catch(error => {
          log.error('Could not clear the request draft', { error: String(error) });
        }),
    [],
  );

  const startDraft = useCallback(
    (next: RequestDraft) => {
      commitDraft(next);
      setIsVendorWithdrawn(false);
      persist(next);
    },
    [commitDraft, persist],
  );

  /**
   * Writes a changed draft down — or forgets one emptied back out.
   *
   * Clearing every answer and leaving is the same intention as never having
   * started, and a home screen offering to resume that would be offering to
   * resume nothing.
   */
  const keepOrForget = useCallback(
    (next: RequestDraft) => {
      if (isDraftWorthKeeping(next)) {
        persist(next);
      } else {
        forget();
      }
    },
    [persist, forget],
  );

  const updateDraft = useCallback(
    (changes: Partial<RequestDraft>) => {
      const current = draftRef.current;
      if (!current) {
        return;
      }

      // A new answer to the vendor question replaces the one that was withdrawn.
      if (changes.vendor !== undefined) {
        setIsVendorWithdrawn(false);
      }

      const next = { ...current, ...changes };
      commitDraft(next);
      keepOrForget(next);
    },
    [commitDraft, keepOrForget],
  );

  const withdrawVendor = useCallback(
    (vendorId: string) => {
      const current = draftRef.current;
      if (!namesVendor(current, vendorId)) {
        // Somebody else by now, or nobody: nothing to withdraw, nothing to say.
        return;
      }

      // Saved as any other change is: a draft whose only answer was this
      // professional is no longer one worth keeping.
      const next: RequestDraft = { ...current, vendor: NO_VENDOR_CHOICE };
      commitDraft(next);
      setIsVendorWithdrawn(true);
      keepOrForget(next);
    },
    [commitDraft, keepOrForget],
  );

  const clearDraft = useCallback((): Promise<void> => {
    commitDraft(null);
    setSavedAt(null);
    setIsVendorWithdrawn(false);
    return forget();
  }, [commitDraft, forget]);

  const recordSubmission = useCallback(
    (submission: SubmittedRequest) => {
      setSubmitted(submission);
      // Exactly what `clearDraft` does, and inseparable from it: the request is
      // out, so there is nothing left to resume.
      commitDraft(null);
      setSavedAt(null);
      setIsVendorWithdrawn(false);
      forget();
    },
    [commitDraft, forget],
  );

  const completion = useMemo(() => (draft ? completionOf(draft) : null), [draft]);

  const value = useMemo(
    () => ({
      draft,
      isRestored,
      savedAt,
      completion,
      startDraft,
      updateDraft,
      withdrawVendor,
      isVendorWithdrawn,
      clearDraft,
      submitted,
      recordSubmission,
    }),
    [
      draft,
      isRestored,
      savedAt,
      completion,
      startDraft,
      updateDraft,
      withdrawVendor,
      isVendorWithdrawn,
      clearDraft,
      submitted,
      recordSubmission,
    ],
  );

  return <RequestDraftContext.Provider value={value}>{children}</RequestDraftContext.Provider>;
}

/**
 * Throws outside the provider rather than returning an empty draft.
 *
 * A screen that reached this without one is mounted somewhere it was never meant
 * to be, which is a wiring bug — and it should surface as one immediately rather
 * than as a Continue button that silently does nothing.
 */
export function useRequestDraft(): RequestDraftContextValue {
  const value = useContext(RequestDraftContext);

  if (!value) {
    throw new Error('useRequestDraft must be used inside a RequestDraftProvider.');
  }

  return value;
}
