/**
 * Typed Redux hooks
 *
 * Always use these instead of the raw `useDispatch` / `useSelector`, so state
 * and dispatch are typed without a generic at every call site.
 */

import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import type { AppDispatch, RootState } from '@/app/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
