/**
 * The customer's copy may promise only what the app can do (21/10/2026).
 *
 * Request Submitted once said "You will hear from us once a professional picks
 * it up", "We will confirm the visit with you before anyone comes round" and
 * "Quote this if you get in touch about this request"; Confirmation said "We
 * will confirm before anyone visits"; the details form said a photo "saves
 * everyone a phone call". The app has one channel to the customer — the
 * notifications inbox behind the bell — and nothing else: no visit
 * confirmation, no calls, no messages, no support desk.
 *
 * The whole file is serialised and searched, so a promise added anywhere in
 * it is caught, not only on the screens that had one.
 */

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';

/** Every string the customer can be shown; functions drop out, which is fine — none promises anything. */
const EVERY_STRING = JSON.stringify(CUSTOMER_COPY);

const CHANNELS_THE_APP_DOES_NOT_HAVE: [string, RegExp][] = [
  ['news without saying how it will come', /hear from us/i],
  ['a visit confirmation', /confirm(s|ed)? (the |a |your )?visit|confirm before/i],
  ['a support desk', /get in touch|contact us|support team|helpline/i],
  ['a phone call', /phone call|call you|call us/i],
  ['a message', /\b(sms|whatsapp|text message|email you|message you)\b/i],
  ['a chat', /\bchat\b/i],
];

describe('Customer copy — the channels it promises', () => {
  it.each(CHANNELS_THE_APP_DOES_NOT_HAVE)('does not promise %s', (_channel, pattern) => {
    expect(EVERY_STRING).not.toMatch(pattern);
  });

  it('names the inbox, by its own name, where it says the customer will be told', () => {
    expect(CUSTOMER_COPY.requestSubmitted.subtitle).toContain(NOTIFICATIONS_COPY.inbox.title);
  });

  it('sends the customer to My Requests, by its own name, to follow the request', () => {
    expect(CUSTOMER_COPY.requestSubmitted.nextMessage).toContain(CUSTOMER_COPY.myRequests.title);
    expect(CUSTOMER_COPY.requestSubmitted.referenceHint).toContain(CUSTOMER_COPY.myRequests.title);
  });
});
