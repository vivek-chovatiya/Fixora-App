/**
 * SelectionChipRail is one row of chips that scrolls sideways (T134,
 * 28/11/2026: the requests lists' filters; before that, the request form's date
 * and time). What is pinned here:
 *
 * - it is one horizontal row, with no scroll indicator, bleeding to the screen
 *   edge and padded back by the gutter, chips spaced by the theme — never a
 *   wrapped block;
 * - it says "one of these" (a named radiogroup of radios, exactly one chosen)
 *   and reports a press as the option's value, nothing more;
 * - the chosen chip is brought into view, moving the row as little as it can:
 *   not at all when the chip is already whole on screen, and from the chip's
 *   size once chosen, not its size before.
 *
 * Layout does not run under the test renderer, so the rail's and the chips'
 * measurements are handed to it the way the native side would.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import ReactTestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';

import { SelectionChipRail, type SelectionChipRailOption } from '@/shared/components';
import { ThemeProvider, screenPadding, spacing } from '@/shared/theme';

type Filter = 'all' | 'pending' | 'active' | 'completed' | 'rejected';

const OPTIONS: ReadonlyArray<SelectionChipRailOption<Filter>> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
];

/**
 * Where each chip sits in the row, as a 360dp phone would measure it: the
 * gutter (16) before the first, the theme's gap (8) between them. The row is
 * 494 wide, so the last two run off the right of a 360 viewport.
 */
const SPANS: Readonly<Record<Filter, { x: number; width: number }>> = {
  all: { x: 16, width: 60 },
  pending: { x: 84, width: 90 },
  active: { x: 182, width: 80 },
  completed: { x: 270, width: 110 },
  rejected: { x: 388, width: 90 },
};
const VIEWPORT = 360;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

function render({ chipTestID }: { chipTestID?: (value: Filter) => string } = {}) {
  const onChange = jest.fn<void, [Filter]>();

  /** Holds the choice the way a screen does, so a press really moves the selection. */
  function Harness() {
    const [value, setValue] = useState<Filter>('all');
    return (
      <SelectionChipRail
        options={OPTIONS}
        value={value}
        onChange={next => {
          onChange(next);
          setValue(next);
        }}
        accessibilityLabel="Show requests"
        accessibilityHint="Shows these requests"
        testID="filters"
        chipTestID={chipTestID}
      />
    );
  }

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const rail = () => renderer.root.findByType(ScrollView);
  // The mock's instance methods are shared, so each render starts its own count.
  const scrollTo = rail().instance.scrollTo as jest.Mock;
  scrollTo.mockClear();

  const chips = () =>
    renderer.root.findAll(
      node => node.props?.accessibilityRole === 'radio' && typeof node.props?.onPress === 'function',
    );

  const chip = (label: string) => {
    const found = chips().find(node => node.props.accessibilityLabel === label);
    if (!found) {
      throw new Error(`No chip labelled "${label}"`);
    }
    return found;
  };

  /** The view a chip is measured by: the nearest ancestor that takes a layout callback. */
  const measuredBy = (label: string): ReactTestInstance => {
    let node: ReactTestInstance | null = chip(label);
    while (node && typeof node.props?.onLayout !== 'function') {
      node = node.parent;
    }
    if (!node) {
      throw new Error(`Nothing measures "${label}"`);
    }
    return node;
  };

  const labelOf = (value: Filter) => OPTIONS.find(option => option.value === value)!.label;

  const measureChip = (value: Filter, span = SPANS[value]) => {
    act(() => {
      measuredBy(labelOf(value)).props.onLayout({
        nativeEvent: { layout: { x: span.x, y: 0, width: span.width, height: 44 } },
      });
    });
  };

  /** The whole row, measured: the viewport and every chip. */
  const measure = () => {
    act(() => {
      rail().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: VIEWPORT, height: 44 } } });
    });
    for (const option of OPTIONS) {
      measureChip(option.value);
    }
  };

  const scrollBy = (x: number) => {
    act(() => {
      rail().props.onScroll({ nativeEvent: { contentOffset: { x, y: 0 } } });
    });
  };

  const choose = (value: Filter) => {
    act(() => {
      chip(labelOf(value)).props.onPress();
    });
  };

  return { renderer, rail, chips, chip, scrollTo, onChange, measure, measureChip, scrollBy, choose };
}

describe('SelectionChipRail — one row that scrolls sideways', () => {
  it('is a horizontal row with no scroll indicator, not a wrapped block', () => {
    const { rail } = render();

    expect(rail().props.horizontal).toBe(true);
    expect(rail().props.showsHorizontalScrollIndicator).toBe(false);
    expect(StyleSheet.flatten(rail().props.contentContainerStyle).flexWrap).toBeUndefined();
  });

  it('bleeds to the screen edge and pads back by the gutter, chips spaced by the theme', () => {
    const { rail } = render();

    expect(StyleSheet.flatten(rail().props.style).marginHorizontal).toBe(-screenPadding);
    expect(StyleSheet.flatten(rail().props.contentContainerStyle)).toEqual(
      expect.objectContaining({ paddingHorizontal: screenPadding, gap: spacing.sm }),
    );
  });

  it('says "one of these": a named radiogroup of radios, exactly one chosen', () => {
    const { rail, chips } = render();

    expect(rail().props.accessibilityRole).toBe('radiogroup');
    expect(rail().props.accessibilityLabel).toBe('Show requests');
    expect(chips().map(node => node.props.accessibilityLabel)).toEqual(
      OPTIONS.map(option => option.label),
    );
    expect(chips().map(node => node.props.accessibilityState.selected)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('reports a press as the option’s value, and draws that one as chosen', () => {
    const { chip, onChange, choose } = render();

    choose('completed');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('completed');
    expect(chip('Completed').props.accessibilityState.selected).toBe(true);
    expect(chip('All').props.accessibilityState.selected).toBe(false);
  });

  it('names each chip `${testID}-${value}`, or by the id the screen gives', () => {
    const plain = render();
    expect(plain.chip('Pending').props.testID).toBe('filters-pending');

    const named = render({ chipTestID: value => `my-requests-filter-${value}` });
    expect(named.chip('Pending').props.testID).toBe('my-requests-filter-pending');
  });
});

describe('SelectionChipRail — the chosen chip in view', () => {
  it('pulls a chip half off the right in just far enough to clear the gutter', () => {
    const { scrollTo, measure, choose } = render();
    measure();

    choose('completed');

    // 270 + 110 + 16 − 360: its right edge one gutter in from the screen edge.
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 36, animated: true });
  });

  it('does not move when the chosen chip is already whole on screen', () => {
    const { scrollTo, measure, choose } = render();
    measure();

    choose('pending');
    choose('active');

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('pulls a chip off the left back in, to the start of the row', () => {
    const { scrollTo, measure, scrollBy, choose } = render();
    measure();
    // Scrolled to the far end and Active chosen there: All is off the left.
    scrollBy(134);
    choose('active');
    expect(scrollTo).not.toHaveBeenCalled();

    choose('all');

    expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });
  });

  it('follows the chip as it grows into its chosen size, not the size it was', () => {
    const { scrollTo, measure, measureChip, choose } = render();
    measure();

    choose('rejected');
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 134, animated: true });

    // Chosen, it gains a tick and a heavier weight, and lays out again wider.
    measureChip('rejected', { x: 388, width: 110 });
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 154, animated: true });

    // Another chip laying out moves nothing.
    scrollTo.mockClear();
    measureChip('pending', { x: 84, width: 92 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('asks for nothing before the row has been measured', () => {
    const { scrollTo, choose } = render();

    choose('rejected');

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
