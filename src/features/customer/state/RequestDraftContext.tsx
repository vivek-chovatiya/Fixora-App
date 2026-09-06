/**
 * RequestDraftContext
 *
 * What the customer has filled in, held between the form and the step that
 * submits it.
 *
 * ⚠️ It exists because request creation stopped being one screen. PROJECT_BIBLE.md
 * section 13 runs details → vendor selection → submit, so the details are
 * collected on one screen and sent from another, and something has to carry them
 * across.
 *
 * Not navigation params. The draft holds the customer's own words and the URLs
 * of photographs of their home; navigation state is serialised, logged by
 * devtools, and restored from disk by any future state-persistence — none of
 * which is a place for either. Params carry flow identifiers, and nothing else.
 *
 * Not Redux and not storage. A half-finished request is not application state
 * that other modules read, and it must not outlive the flow: an abandoned draft
 * restored a week later is a request nobody meant to send. It lives exactly as
 * long as the customer navigator is mounted, and is cleared the moment it is
 * either submitted or replaced.
 *
 * Deliberately one draft. A customer is filling in one request; a map keyed by
 * anything would be inventing a multi-draft product nobody asked for.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import type { CreateRequestForm } from '@/features/customer/validation/requestSchemas';

/**
 * A request as far as the details screen got it.
 *
 * The identifiers are here rather than read again from the route because they
 * are part of what was drafted: the draft is a complete answer to "what would be
 * submitted", which is what makes the submitting screen simple.
 */
export interface RequestDraft {
  categoryId: string;
  subCategoryId: string;
  /** Exactly the form's values, untranslated. The payload is built at submit. */
  values: CreateRequestForm;
  /** Remote URLs of photographs that finished uploading (section 16). */
  imageUrls: string[];
}

interface RequestDraftContextValue {
  draft: RequestDraft | null;
  /** Replaces whatever was there. Starting a new request abandons the old one. */
  startDraft: (draft: RequestDraft) => void;
  clearDraft: () => void;
}

const RequestDraftContext = createContext<RequestDraftContextValue | undefined>(undefined);

export function RequestDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<RequestDraft | null>(null);

  const startDraft = useCallback((next: RequestDraft) => {
    setDraft(next);
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const value = useMemo(
    () => ({ draft, startDraft, clearDraft }),
    [draft, startDraft, clearDraft],
  );

  return <RequestDraftContext.Provider value={value}>{children}</RequestDraftContext.Provider>;
}

/**
 * Throws outside the provider rather than returning a null draft.
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
