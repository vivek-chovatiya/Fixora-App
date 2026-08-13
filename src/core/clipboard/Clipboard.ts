/**
 * Clipboard
 *
 * Copies text to the device clipboard.
 *
 * An interface with a swappable implementation, following SessionStorage. This
 * is the only file in the application permitted to import a clipboard module —
 * screens and components go through `getClipboard()`, so replacing the
 * underlying library is a change here and nowhere else.
 *
 * That guarantee has already paid for itself once: the implementation moved from
 * React Native's deprecated built-in Clipboard to
 * `@react-native-clipboard/clipboard` without a single caller changing.
 *
 * Nothing copied here is ever logged. The vendor auth code passes through this
 * module, and a log line is exactly the leak the credential rules forbid.
 */

import ReactNativeClipboardModule from '@react-native-clipboard/clipboard';

import { createLogger } from '@/core/logger/Logger';

const log = createLogger('Clipboard');

export interface Clipboard {
  /** Resolves once the value is on the clipboard, rejects if it could not be set. */
  copy(value: string): Promise<void>;
}

class NativeClipboard implements Clipboard {
  async copy(value: string): Promise<void> {
    // `setString` is synchronous. The interface is async so an implementation
    // that needs to await something — a permission prompt, a secure paste
    // buffer — can be swapped in without changing a caller.
    ReactNativeClipboardModule.setString(value);

    // Length only. The value itself must never reach a log.
    log.info('Copied to clipboard', { length: value.length });
  }
}

let clipboard: Clipboard = new NativeClipboard();

export function getClipboard(): Clipboard {
  return clipboard;
}

/** Swaps the implementation. For tests, and for the eventual package migration. */
export function setClipboard(implementation: Clipboard): void {
  clipboard = implementation;
}
