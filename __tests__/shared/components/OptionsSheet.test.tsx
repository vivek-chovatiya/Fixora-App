/**
 * OptionsSheet offers a few things to do and does none of them itself. Pinned:
 *
 * - a choice runs once, after the sheet has started to go — on iOS only when
 *   the modal has finished dismissing (its `onDismiss`), because iOS presents
 *   nothing over a view that is leaving (a dialog, the camera, the photo
 *   library); on Android at once;
 * - one choice per opening: a second press while it is closing does nothing,
 *   and showing it again allows a new one;
 * - a disabled option is drawn and announced as disabled and does nothing,
 *   however it is reached;
 * - every way out that is not an option — Cancel, the backdrop, Android's back
 *   button — is `onClose`, and choosing nothing runs nothing later;
 * - it is one named, modal region with a heading; each option is a button with
 *   its words and hint; a danger option is told apart by its glyph and words,
 *   its label staying in the ordinary ink.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Modal, Platform } from 'react-native';

import { OptionsSheet, type OptionsSheetOption, type OptionsSheetProps } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';

type Instance = ReactTestRenderer.ReactTestInstance;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  jest.restoreAllMocks();
});

function render(overrides: Partial<OptionsSheetProps> = {}) {
  const gallery = jest.fn();
  const remove = jest.fn();
  const onClose = jest.fn();
  const options: OptionsSheetOption[] = [
    { key: 'gallery', label: 'Choose from gallery', hint: 'Opens your photos', icon: 'gallery', onSelect: gallery },
    { key: 'remove', label: 'Remove photo', icon: 'remove', tone: 'danger', onSelect: remove },
  ];

  const element = (props: Partial<OptionsSheetProps>) => (
    <ThemeProvider>
      <OptionsSheet
        visible
        title="Their photo"
        options={options}
        onClose={onClose}
        cancelLabel="Cancel"
        cancelHint="Closes the photo options"
        testID="sheet"
        {...overrides}
        {...props}
      />
    </ThemeProvider>
  );

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(element({}));
  });
  mounted.push(renderer);

  const pressable = (label: string): Instance | undefined =>
    renderer.root.findAll(
      node => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
    )[0];
  const modal = () => renderer.root.findByType(Modal);

  return {
    renderer,
    gallery,
    remove,
    onClose,
    pressable,
    modal,
    press: (label: string) => {
      const target = pressable(label);
      if (!target) {
        throw new Error(`Nothing pressable labelled "${label}"`);
      }
      act(() => {
        target.props.onPress();
      });
    },
    /** The parent closing it, as every caller does from `onClose`. */
    hide: () => {
      act(() => {
        renderer.update(element({ visible: false }));
      });
    },
    /** The parent opening it again. */
    show: () => {
      act(() => {
        renderer.update(element({ visible: true }));
      });
    },
  };
}

describe('OptionsSheet — choosing', () => {
  it('on iOS, closes at once and runs the choice only once the sheet has gone', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const sheet = render();
    const dismissed = sheet.modal().props.onDismiss;

    sheet.press('Choose from gallery');

    expect(sheet.onClose).toHaveBeenCalledTimes(1);
    expect(sheet.gallery).not.toHaveBeenCalled();

    sheet.hide();
    act(() => {
      dismissed();
    });
    expect(sheet.gallery).toHaveBeenCalledTimes(1);

    // A second dismissal is not a second choice.
    act(() => {
      dismissed();
    });
    expect(sheet.gallery).toHaveBeenCalledTimes(1);
    expect(sheet.remove).not.toHaveBeenCalled();
  });

  it('on Android, closes and runs the choice at once', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const sheet = render();

    sheet.press('Remove photo');

    expect(sheet.onClose).toHaveBeenCalledTimes(1);
    expect(sheet.remove).toHaveBeenCalledTimes(1);
    expect(sheet.gallery).not.toHaveBeenCalled();
  });

  /*
    Android runs a choice while the sheet is still fading out and its rows
    still take presses: a quick second tap ran an option twice (reviewer
    finding, 28/11/2026). The rows are pressed through the handlers drawn
    before the first press, as a double tap reaches them.
  */
  it('on Android, runs one choice for two quick presses, the second a different option', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const sheet = render();
    const remove = sheet.pressable('Remove photo') as Instance;
    const gallery = sheet.pressable('Choose from gallery') as Instance;

    act(() => {
      remove.props.onPress();
      remove.props.onPress();
      gallery.props.onPress();
    });

    expect(sheet.remove).toHaveBeenCalledTimes(1);
    expect(sheet.gallery).not.toHaveBeenCalled();
    expect(sheet.onClose).toHaveBeenCalledTimes(1);
  });

  it('allows a new choice once the sheet is shown again', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const sheet = render();

    sheet.press('Remove photo');
    sheet.hide();
    sheet.show();
    sheet.press('Choose from gallery');

    expect(sheet.remove).toHaveBeenCalledTimes(1);
    expect(sheet.gallery).toHaveBeenCalledTimes(1);
    expect(sheet.onClose).toHaveBeenCalledTimes(2);
  });

  it('on iOS, keeps the first choice when a second tap lands before the sheet has gone', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const sheet = render();
    const dismissed = sheet.modal().props.onDismiss;

    sheet.press('Choose from gallery');
    sheet.press('Remove photo');
    sheet.hide();
    act(() => {
      dismissed();
    });

    expect(sheet.gallery).toHaveBeenCalledTimes(1);
    expect(sheet.remove).not.toHaveBeenCalled();
    expect(sheet.onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a disabled option, however it is reached', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const select = jest.fn();
    const sheet = render({
      options: [{ key: 'mark', label: 'Mark all as read', icon: 'markAllRead', disabled: true, onSelect: select }],
    });

    const option = sheet.pressable('Mark all as read') as Instance;
    expect(option.props.accessibilityState).toEqual({ disabled: true });
    expect(option.props.disabled).toBe(true);

    sheet.press('Mark all as read');

    expect(select).not.toHaveBeenCalled();
    expect(sheet.onClose).not.toHaveBeenCalled();
  });
});

describe('OptionsSheet — leaving', () => {
  it('closes on Cancel, the backdrop and Android’s back button, and runs nothing afterwards', () => {
    const sheet = render();
    const dismissed = sheet.modal().props.onDismiss;

    sheet.press('Cancel');
    act(() => {
      sheet.renderer.root.findByProps({ testID: 'sheet-backdrop' }).props.onPress();
    });
    act(() => {
      sheet.modal().props.onRequestClose();
    });

    expect(sheet.onClose).toHaveBeenCalledTimes(3);
    act(() => {
      dismissed();
    });
    expect(sheet.gallery).not.toHaveBeenCalled();
    expect(sheet.remove).not.toHaveBeenCalled();
  });

  it('draws nothing while closed', () => {
    const sheet = render({ visible: false });

    expect(sheet.pressable('Choose from gallery')).toBeUndefined();
    // Host views only: the component itself carries the testID it was given.
    const drawn = sheet.renderer.root
      .findAll(node => typeof node.type === 'string' && node.props?.testID === 'sheet')
      .map(node => node.props.testID);
    expect(drawn).toEqual([]);
  });
});

describe('OptionsSheet — what it says', () => {
  it('is one modal region named by its heading', () => {
    const sheet = render();

    const region = sheet.renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'sheet',
    )[0];
    expect(region.props.accessibilityViewIsModal).toBe(true);
    expect(region.props.accessibilityLabel).toBe('Their photo');
    const headers = region.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityRole === 'header',
    );
    expect(headers).toHaveLength(1);
    // The backdrop is not a second Cancel for a screen reader.
    const backdrop = sheet.renderer.root.findByProps({ testID: 'sheet-backdrop' });
    expect(backdrop.props.importantForAccessibility).toBe('no');
  });

  it('makes each option a button with its words, its hint and its state', () => {
    const sheet = render();

    const gallery = sheet.pressable('Choose from gallery') as Instance;
    expect(gallery.props.accessibilityRole).toBe('button');
    expect(gallery.props.accessibilityHint).toBe('Opens your photos');
    expect(gallery.props.accessibilityState).toEqual({ disabled: false });
    expect((sheet.pressable('Cancel') as Instance).props.accessibilityHint).toBe('Closes the photo options');
  });

  it('marks a danger option by its glyph, never by turning its words red', () => {
    const sheet = render();

    // `Icon` is memoised, so it is found by what it is handed rather than by type.
    const glyphs = sheet.renderer.root
      .findAll(node => typeof node.props?.name === 'string' && node.props?.size === 'lg' && 'color' in node.props)
      .map(icon => [icon.props.name, icon.props.color]);
    expect(glyphs).toEqual(
      expect.arrayContaining([
        ['gallery', 'textSecondary'],
        ['remove', 'danger'],
      ]),
    );
    const words = (sheet.pressable('Remove photo') as Instance).findAll(
      node => node.props?.variant === 'subtitle',
    );
    expect(words.length).toBeGreaterThan(0);
    words.forEach(node => expect(node.props.color).toBeUndefined());
  });
});
