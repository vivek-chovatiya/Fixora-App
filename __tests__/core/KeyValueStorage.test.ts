/**
 * KeyValueStorage is the door features use instead of AsyncStorage. Two things
 * about it are invisible from the features that rely on it, so they are pinned
 * here: every key stays inside the app's namespace, and a device failure reaches
 * the caller rather than being decided for it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';

const KEY = `${AppConfig.storage.keyPrefix}/key-value-test`;

afterEach(async () => {
  await AsyncStorage.removeItem(KEY);
});

describe('KeyValueStorage', () => {
  it('stores, reads back and removes a string', async () => {
    const storage = getKeyValueStorage();

    await storage.setItem(KEY, 'value');
    expect(await storage.getItem(KEY)).toBe('value');

    await storage.removeItem(KEY);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it.each(['session', 'fixora/session', '@fixora', '@fixoraX/session'])(
    'refuses the key %p, which is outside the app namespace',
    async key => {
      const storage = getKeyValueStorage();

      await expect(storage.setItem(key, 'value')).rejects.toBeDefined();
      await expect(storage.getItem(key)).rejects.toBeDefined();
      await expect(storage.removeItem(key)).rejects.toBeDefined();
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(key, expect.anything());
    },
  );

  it('passes a failed write to the caller instead of deciding what it means', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(getKeyValueStorage().setItem(KEY, 'value')).rejects.toThrow('disk full');
  });

  it('passes a failed read to the caller too', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('unreadable'));

    await expect(getKeyValueStorage().getItem(KEY)).rejects.toThrow('unreadable');
  });
});
