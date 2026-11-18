/**
 * The reference people quote, wherever the vendor app shows one (request
 * contract, 17/11/2026): the backend's `requestNumber` arrives as `reference`
 * beside the database `id`. On the card, the spoken labels of its Accept,
 * Reject, Start and Complete buttons, the completion and payment forms, and
 * a review card, it is `reference` — and when there is none, no reference is
 * shown or said at all: the id is a database id nobody can quote (code
 * review, 17/11/2026). The id is still what every press and route hands on:
 * ids travel, display data does not.
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { JobPreviewCard } from '@/features/vendor/components/JobPreviewCard';
import { RequestAnswerActions } from '@/features/vendor/components/RequestAnswerActions';
import { RequestWorkAction } from '@/features/vendor/components/RequestWorkAction';
import { presentVendorReview } from '@/features/vendor/constants/reviewPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useRequestReference } from '@/features/vendor/hooks/useRequestReference';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { VendorReview } from '@/shared/services/types/ReviewService';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorRequestService } from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const ID = '6afc3ff63331bf0e0e5835b5';
const REFERENCE = 'REQ-213754';

const job = (extra: Partial<VendorJobSummary> = {}): VendorJobSummary => ({
  id: ID,
  serviceName: 'Fan & Light Installation',
  locality: 'Koramangala, Bengaluru',
  priority: 'HIGH',
  status: 'PENDING_VENDOR',
  dispatch: 'broadcast',
  createdAt: '2026-11-17T11:39:21.050Z',
  ...extra,
});

let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

async function render(element: React.ReactElement): Promise<ReactTestRenderer.ReactTestRenderer> {
  await act(async () => {
    renderer = ReactTestRenderer.create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return renderer as ReactTestRenderer.ReactTestRenderer;
}

/** Every string a screen reader or an eye would meet. */
function everything(tree: ReactTestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  resetServices();
});

describe('the card', () => {
  it('shows the reference, not the database id, when the backend keeps one', async () => {
    const tree = await render(<JobPreviewCard job={job({ reference: REFERENCE })} />);

    expect(everything(tree)).toContain(`${VENDOR_COPY.job.referencePrefix} ${REFERENCE}`);
    expect(everything(tree)).not.toContain(ID);
  });

  it('shows no reference at all when there is none — never the database id', async () => {
    const tree = await render(<JobPreviewCard job={job()} onPress={jest.fn()} />);

    expect(everything(tree)).not.toContain(ID);
    expect(everything(tree)).not.toContain(`${VENDOR_COPY.job.referencePrefix} `);
    // The spoken card still names the job, the reference simply left out.
    expect(everything(tree)).toContain('Fan & Light Installation');
  });

  it('hands on the id when pressed — never the reference', async () => {
    const onPress = jest.fn();
    const tree = await render(<JobPreviewCard job={job({ reference: REFERENCE })} onPress={onPress} />);

    // The pressable inside the card, not the card's own prop.
    const pressable = tree.root.findAll(
      node => typeof node.props.onPress === 'function' && node.props.onPress !== onPress,
    )[0];
    await act(async () => pressable.props.onPress());

    expect(onPress).toHaveBeenCalledWith(ID);
  });
});

describe('the buttons’ spoken labels', () => {
  const spoken = `${VENDOR_COPY.job.referencePrefix} ${REFERENCE}`;

  it('name the request by its reference on Accept and Reject, and hand on the id', async () => {
    const onAccept = jest.fn();
    const tree = await render(
      <RequestAnswerActions
        job={job({ reference: REFERENCE })}
        answering={null}
        disabled={false}
        onAccept={onAccept}
        onReject={jest.fn()}
      />,
    );

    const accept = tree.root.find(
      node => node.props.accessibilityLabel === VENDOR_COPY.answer.acceptSpoken('Fan & Light Installation', spoken),
    );
    tree.root.find(
      node => node.props.accessibilityLabel === VENDOR_COPY.answer.rejectSpoken('Fan & Light Installation', spoken),
    );
    await act(async () => accept.props.onPress());

    expect(onAccept).toHaveBeenCalledWith(ID);
  });

  it('say no reference when there is none — never the database id', async () => {
    const tree = await render(
      <RequestAnswerActions job={job()} answering={null} disabled={false} onAccept={jest.fn()} onReject={jest.fn()} />,
    );

    expect(
      tree.root.findAll(
        node => node.props.accessibilityLabel === VENDOR_COPY.answer.acceptSpoken('Fan & Light Installation'),
      ).length,
    ).toBeGreaterThan(0);
    expect(everything(tree)).not.toContain(ID);
  });

  it('name the request by its reference on Start work', async () => {
    const tree = await render(
      <RequestWorkAction
        job={job({ reference: REFERENCE, status: 'ACCEPTED' })}
        step="start"
        answering={null}
        disabled={false}
        onStep={jest.fn()}
      />,
    );

    expect(
      tree.root.findAll(
        node => node.props.accessibilityLabel === VENDOR_COPY.work.startSpoken('Fan & Light Installation', spoken),
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('the completion and payment forms (useRequestReference)', () => {
  /** What the two forms draw under their title, through the hook they share: a line only with a reference. */
  function FormReference({ requestId }: { requestId: string }) {
    const reference = useRequestReference(requestId);
    return reference ? <Text testID="form-reference">{`${VENDOR_COPY.job.referencePrefix} ${reference}`}</Text> : null;
  }

  /** A request service that answers `getRequest` only, and counts it. */
  function requestsAnswering(read: (id: string) => Promise<unknown>) {
    const getRequest = jest.fn(read);
    registerService('vendorRequests', { getRequest } as unknown as VendorRequestService);
    return getRequest;
  }

  const shown = (tree: ReactTestRenderer.ReactTestRenderer) =>
    tree.root.findAllByProps({ testID: 'form-reference' })[0]?.props.children as string | undefined;

  it('shows no line at once, then the reference the one read answers with', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const getRequest = requestsAnswering(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );

    const tree = await render(<FormReference requestId={ID} />);
    expect(shown(tree)).toBeUndefined();

    await act(async () => answer(job({ reference: REFERENCE })));

    expect(shown(tree)).toBe(`${VENDOR_COPY.job.referencePrefix} ${REFERENCE}`);
    expect(getRequest).toHaveBeenCalledTimes(1);
    expect(getRequest).toHaveBeenCalledWith(ID);
  });

  it('draws no line when the request has no reference — never the database id', async () => {
    requestsAnswering(async () => job());

    const tree = await render(<FormReference requestId={ID} />);

    expect(shown(tree)).toBeUndefined();
  });

  it('draws no line when the read fails — decoration, never a gate', async () => {
    // The query logs the failure, as it does every failed read.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const getRequest = requestsAnswering(async () => {
      throw new AppError({ kind: 'network' });
    });

    const tree = await render(<FormReference requestId={ID} />);

    expect(shown(tree)).toBeUndefined();
    // Nothing retries it on its own.
    expect(getRequest).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe('a review card', () => {
  const review = (extra: Partial<VendorReview> = {}): VendorReview => ({
    requestId: ID,
    rating: 5,
    submittedAt: '2026-11-16T10:00:00.000Z',
    serviceName: 'Fan & Light Installation',
    ...extra,
  });

  it('names the job by its reference when the backend sends one', () => {
    const card = presentVendorReview(review({ reference: REFERENCE }), new Date('2026-11-17T10:00:00.000Z'));

    expect(card.context).toContain(`${VENDOR_COPY.job.referencePrefix} ${REFERENCE}`);
    expect(JSON.stringify(card)).not.toContain(ID);
  });

  it.each([undefined, '  '])('names no reference — never the request id — when the reference is %p', reference => {
    const card = presentVendorReview(review({ reference }), new Date('2026-11-17T10:00:00.000Z'));

    expect(card.context).toBe('Fan & Light Installation');
    expect(JSON.stringify(card)).not.toContain(ID);
  });

  it('has no context line at all with neither a service nor a reference', () => {
    const card = presentVendorReview(
      review({ serviceName: undefined }),
      new Date('2026-11-17T10:00:00.000Z'),
    );

    expect(card).not.toHaveProperty('context');
    expect(JSON.stringify(card)).not.toContain(ID);
  });
});
