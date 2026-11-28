/**
 * `Accept-Language` on every API call (phase5-contract.md section 7).
 *
 * A seam: the backend ignores it today. What is pinned is that every request —
 * JSON and multipart alike — says the language the app is speaking at the moment
 * it is sent, read per request, so a change applies to the very next call.
 */

import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import { Http, httpClient } from '@/core/http/HttpClient';
import { resetLocaleState, updateLocaleState } from '@/core/i18n';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    return { data: { success: true, data: null }, status: 200, statusText: '', headers: {}, config };
  };
  httpClient.defaults.adapter = adapter;
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  sent.length = 0;
  jest.restoreAllMocks();
  resetLocaleState();
  updateLocaleState({ isChosen: true, isRestored: true });
});

const languageOf = (config: InternalAxiosRequestConfig) => config.headers.get('Accept-Language');

describe('Accept-Language', () => {
  it('says English by default', async () => {
    await Http.get('/requests');

    expect(languageOf(sent[0])).toBe('en');
  });

  it('says the language the app speaks when each request is sent', async () => {
    updateLocaleState({ locale: 'hi' });
    await Http.post('/requests/list', {});
    updateLocaleState({ locale: 'gu' });
    await Http.patch('/profile', { firstName: 'Asha' });
    updateLocaleState({ locale: 'en' });
    await Http.delete('/notifications/1');

    expect(sent.map(languageOf)).toEqual(['hi', 'gu', 'en']);
  });

  it('is on a file upload too', async () => {
    updateLocaleState({ locale: 'gu' });
    await Http.postForm('/uploads', new FormData());

    expect(languageOf(sent[0])).toBe('gu');
  });
});
