/**
 * useAddressSearch
 *
 * Candidate addresses for what the customer is typing.
 *
 *   Screen → hook → AddressService interface → implementation
 *
 * ⚠️ Debounced, and that is not a performance nicety. A geocoding provider is
 * billed per call and rate-limited, so a search fired on every keystroke is a
 * bill and a throttling error rather than a faster list. The delay is also what
 * stops the list flickering through three wrong answers on the way to the right
 * one.
 *
 * ⚠️ Failure is never fatal here, and emptiness is not failure. A customer whose
 * street no gazetteer has heard of must still be able to book a plumber, so the
 * screen keeps what they typed either way — this reports what happened and
 * decides nothing.
 *
 * `useServiceQuery` is deliberately not used. That hook runs a query when its
 * dependencies change and owns the retry; this one has to *not* run for a query
 * that is too short, cancel a request that has been superseded, and never
 * present the answer to a question the customer has already typed past.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { getService } from '@/shared/services/ServiceRegistry';
import type { AddressSuggestion } from '@/shared/services/types/AddressService';
import { AppError } from '@/shared/types/error';

const log = createLogger('useAddressSearch');

/**
 * How long typing settles before the provider is asked.
 *
 * Long enough that a typed street is one call rather than twelve, short enough
 * that the list feels like it is keeping up.
 */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Below this, nothing is searched at all.
 *
 * Mirrors the floor the mock provider enforces. Kept here as well rather than
 * relying on the service, because the point is to make no call — a hook that
 * asked and was handed an empty list would have paid for the answer.
 */
export const MIN_QUERY_LENGTH = 3;

export interface AddressSearch {
  suggestions: AddressSuggestion[];
  isSearching: boolean;
  /** Safe wording only. Never the provider's own message. */
  error: AppError | null;
  /** True once a search has run for the current query and found nothing. */
  hasSearchedEmpty: boolean;
}

export function useAddressSearch(query: string): AddressSearch {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [hasSearchedEmpty, setHasSearchedEmpty] = useState(false);

  /**
   * Which search is the current one.
   *
   * Answers arrive in whatever order the network feels like, so a slow reply to
   * "koram" must not overwrite a fast reply to "koramangala". Every result
   * checks that its own request is still the latest before it is shown.
   */
  const latest = useRef(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (text: string, token: number) => {
    try {
      const found = await getService('address').searchAddresses(text);

      if (!mounted.current || latest.current !== token) {
        return;
      }

      setSuggestions(found);
      setHasSearchedEmpty(found.length === 0);
    } catch (caught) {
      if (!mounted.current || latest.current !== token) {
        return;
      }

      /*
        The provider's own message never reaches the screen.

        `AppError.userMessage` is the safe half; anything else — a rate-limit
        body, a key error, a stack — is developer information that would be
        alarming and useless to a customer trying to say where they live.
      */
      log.warn('Address search failed', { error: String(caught) });
      setError(AppError.from(caught));
      setSuggestions([]);
      setHasSearchedEmpty(false);
    } finally {
      if (mounted.current && latest.current === token) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    const text = query.trim();
    const token = latest.current + 1;
    latest.current = token;

    // A cleared or barely-started box is not a search. Everything resets, so an
    // old list does not sit under a box the customer has just emptied.
    if (text.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsSearching(false);
      setError(null);
      setHasSearchedEmpty(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    const timer = setTimeout(() => {
      void run(text, token);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, run]);

  return { suggestions, isSearching, error, hasSearchedEmpty };
}
