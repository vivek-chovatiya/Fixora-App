/**
 * InfoNotice
 *
 * A calm note at the top of a request-flow screen: something the customer
 * should know before they answer, and nothing wrong. Two screens say one:
 * Create Request, about another service's unfinished request that Continue will
 * replace (3D-10), and Preferred Vendor, about a chosen professional the list
 * no longer has (3D-12).
 *
 * ⚠️ One card, made from two (Phase 3D-12, 21/10/2026). Preferred Vendor's was
 * first written as a copy of Create Request's; with two real consumers it is
 * this component, so the next change to the look is made once.
 *
 * The info tone, never the warning one — nothing has failed and nothing happens
 * unless the customer acts — on its subtle tint with the `info` glyph and no
 * shadow. Not `StaleNotice` (a failed refresh, in the warning tone, with a
 * retry and an alert) and not the vendor's `AvailabilityNotice` (a state the
 * vendor chose, with an action): this has no action of its own, because the
 * way on is the screen's own controls below it.
 *
 * ⚠️ One spoken element: the words together, as one stop, so a screen reader
 * hears the second sentence with the first and never the glyph. `announce`
 * makes it a polite live region, for a notice that appears after the screen
 * has been read — Preferred Vendor's arrives when the list lands. Create
 * Request's does not ask for it, as it never has.
 *
 * The sentence heads the card in the strong weight only when there is a
 * detail under it to head; a sentence on its own is not a heading, and is
 * drawn in the body weight.
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface InfoNoticeProps {
  /** The sentence the customer needs. */
  text: string;
  /** A quieter sentence under it, when there is one. */
  detail?: string;
  /** Says it when it appears: for a notice that arrives after the screen was read. */
  announce?: boolean;
  style?: StyleProp<ViewStyle>;
  /** The card's; the one spoken element is this with `-text` after it. */
  testID: string;
}

export function InfoNotice({ text, detail, announce = false, style, testID }: InfoNoticeProps) {
  const theme = useTheme();

  return (
    <Card bordered background="infoSubtle" shadow="none" style={style} testID={testID}>
      <View
        style={[styles.row, { gap: theme.spacing.sm }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={detail ? `${text} ${detail}` : text}
        accessibilityLiveRegion={announce ? 'polite' : undefined}
        testID={`${testID}-text`}>
        {/* The tint's own ink, words and glyph (3G-4): `info` is 4.2:1 / 4.0:1 here. */}
        <Icon name="info" size="md" color="onInfoSubtle" />
        <View style={[styles.copy, { gap: theme.spacing.xxs }]}>
          <Text variant={detail ? 'bodyStrong' : 'body'} color="onInfoSubtle">
            {text}
          </Text>
          {detail ? (
            <Text variant="caption" color="onInfoSubtle">
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  copy: {
    // A definite width, so the sentence wraps inside the card rather than
    // being measured at its own width and clipped (the 3E-3 lesson).
    flex: 1,
  },
});
