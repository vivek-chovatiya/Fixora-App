/**
 * Clipboard
 *
 * Copies text to the device clipboard.
 *
 * An interface with a swappable implementation, following SessionStorage. No
 * screen imports a clipboard module directly, so the one place this is done can
 * change without touching a caller — which matters here, because the default
 * implementation is on borrowed time.
 *
 * ⚠️ The default uses React Native's built-in Clipboard, which is deprecated and
 * warns on first use: it has moved to `@react-native-clipboard/clipboard` and
 * will be removed from core. Adding that package is a new native dependency, so
 * it is not done here on the way past. When core drops Clipboard, this file is
 * the only thing that changes.
 *
 * Nothing copied here is ever logged. The vendor auth code passes through this
 * module, and a log line is exactly the leak the credential rules forbid.
 */

import { createLogger } from '@/core/logger/Logger';

const log = createLogger('Clipboard');

export interface Clipboard {
  /** Resolves once the value is on the clipboard, rejects if it could not be set. */
  copy(value: string): Promise<void>;
}

class ReactNativeClipboard implements Clipboard {
  async copy(value: string): Promise<void> {
    // Required lazily so importing this module does not trigger React Native's
    // deprecation warning in processes that never copy anything — tests, most
    // of all.
    const { Clipboard: NativeClipboard } = require('react-native');

    NativeClipboard.setString(value);
    // Length only. The value itself must never reach a log.
    log.info('Copied to clipboard', { length: value.length });
  }
}

let clipboard: Clipboard = new ReactNativeClipboard();

export function getClipboard(): Clipboard {
  return clipboard;
}

/** Swaps the implementation. For tests, and for the eventual package migration. */
export function setClipboard(implementation: Clipboard): void {
  clipboard = implementation;
}
