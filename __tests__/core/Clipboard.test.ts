/**
 * The clipboard abstraction exists so that exactly one file imports a clipboard
 * library, and so that what is copied never reaches a log. Both are asserted
 * here, because both are invisible from the screens that rely on them.
 */

import ReactNativeClipboardModule from '@react-native-clipboard/clipboard';

import { getClipboard, setClipboard, type Clipboard } from '@/core/clipboard/Clipboard';

const SENSITIVE = 'FX-ABCD-2345';

describe('Clipboard', () => {
  const original: Clipboard = getClipboard();

  afterEach(() => {
    setClipboard(original);
    jest.restoreAllMocks();
  });

  it('copies through the clipboard package', async () => {
    const setString = jest.spyOn(ReactNativeClipboardModule, 'setString');

    await getClipboard().copy(SENSITIVE);

    expect(setString).toHaveBeenCalledWith(SENSITIVE);
  });

  it('logs that a copy happened, never what was copied', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(ReactNativeClipboardModule, 'setString').mockImplementation(() => {});

    await getClipboard().copy(SENSITIVE);

    const logged = consoleLog.mock.calls
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');

    expect(logged).toContain('Copied to clipboard');
    expect(logged).not.toContain(SENSITIVE);
  });

  it('can be swapped, which is how screens stay free of the library', async () => {
    const copy = jest.fn(async () => undefined);
    setClipboard({ copy });

    await getClipboard().copy(SENSITIVE);

    expect(copy).toHaveBeenCalledWith(SENSITIVE);
  });
});
