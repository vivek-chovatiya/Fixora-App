/**
 * TeamMemberCard
 *
 * One person on the vendor's team (PROJECT_BIBLE.md section 39): who they are,
 * what they do, how to reach them — and Edit and Remove.
 *
 * ⚠️ The details are one block for a screen reader ("Suresh Naik, Senior
 * technician. Phone 9000000101"), and the two actions sit under it as siblings,
 * never inside it — the request card's rule (3E-4): a button inside a button
 * cannot be focused on Android, and a tap on Remove must never be a tap on
 * anything else.
 *
 * ⚠️ Every action names the member it acts on — "Remove Suresh Naik", not
 * "Remove" five times down a list — and starts with the word on the button, so
 * voice control finds it by what it can see. Remove is the danger button, as on
 * the address book, and always asks first (the screen's dialog).
 *
 * ⚠️ Long names and roles wrap to two lines and are then cut short on screen,
 * never in what is spoken. A member with no phone has no phone line — not an
 * empty one, and not "Not added". Section 39's Profile Image is the avatar
 * (2026-10-21): the member's photo when they have one, their initials when
 * they do not or it will not load. It sits inside the hidden block, so a
 * screen reader hears the same sentence with or without it — never a separate
 * "profile picture" stop.
 *
 * ⚠️ A disabled member (section 39's "Status") carries a neutral "Disabled"
 * badge under their details, and the spoken block ends with it: "Farhan Ali,
 * Helper. Disabled". An active member carries nothing — it is how nearly
 * everybody is. A status the app does not know shows "Status unavailable"
 * (`teamMemberStatus.ts`). Nothing else about the card changes: a disabled
 * member keeps their place, and Edit and Remove work as before — the edit
 * form is where the status is changed.
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { presentTeamMemberStatus } from '@/features/vendor/constants/teamMemberStatus';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  Avatar,
  Button,
  Card,
  Icon,
  SecondaryButton,
  StatusBadge,
  Text,
} from '@/shared/components';
import type { TeamMember } from '@/shared/services/types/VendorTeamService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.team;

export interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (memberId: string) => void;
  onRemove: (memberId: string) => void;
  /** This member is being removed: Remove shows busy. */
  isRemoving: boolean;
  /** Another change is running, or the list is being read again: nothing can be pressed. */
  disabled: boolean;
  testID?: string;
}

function TeamMemberCardComponent({
  member,
  onEdit,
  onRemove,
  isRemoving,
  disabled,
  testID,
}: TeamMemberCardProps) {
  const theme = useTheme();

  const edit = useCallback(() => onEdit(member.id), [member.id, onEdit]);
  const remove = useCallback(() => onRemove(member.id), [member.id, onRemove]);

  const status = presentTeamMemberStatus(member.status);
  const details = COPY.memberSpoken(member.name, member.role, member.phone);

  return (
    <Card bordered shadow="sm" style={{ gap: theme.spacing.md }} testID={testID}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          status.showOnCard ? COPY.memberWithStatusSpoken(details, status.label) : details
        }>
        <View
          style={[styles.details, { gap: theme.spacing.md }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Avatar
            uri={member.photoUrl}
            name={member.name}
            size="md"
            testID={testID ? `${testID}-avatar` : undefined}
          />

          {/*
            A definite width (`flex: 1`), not one sized by the words: a wrapping
            line measured by its own content in a row can lose its last word at
            360dp (3E-3).
          */}
          <View style={[styles.fill, { gap: theme.spacing.xxs }]}>
            <Text
              variant="bodyStrong"
              numberOfLines={2}
              testID={testID ? `${testID}-name` : undefined}>
              {member.name}
            </Text>
            <Text
              variant="body"
              color="textSecondary"
              numberOfLines={2}
              testID={testID ? `${testID}-role` : undefined}>
              {member.role}
            </Text>
            {member.phone ? (
              <View style={[styles.phone, { gap: theme.spacing.xs }]}>
                <Icon name="call" size="sm" color="textTertiary" />
                <Text
                  variant="caption"
                  color="textSecondary"
                  numberOfLines={1}
                  style={styles.shrinks}
                  testID={testID ? `${testID}-phone` : undefined}>
                  {member.phone}
                </Text>
              </View>
            ) : null}
            {status.showOnCard ? (
              <View style={{ paddingTop: theme.spacing.xxs }}>
                <StatusBadge
                  label={status.label}
                  tone={status.tone}
                  testID={testID ? `${testID}-status` : undefined}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Side by side where they fit, stacked where they do not. */}
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <SecondaryButton
          label={COPY.edit}
          icon="edit"
          onPress={edit}
          disabled={disabled}
          accessibilityLabel={COPY.editSpoken(member.name)}
          accessibilityHint={COPY.editHint}
          style={styles.action}
        />
        <Button
          label={COPY.remove}
          variant="danger"
          icon="remove"
          onPress={remove}
          isLoading={isRemoving}
          disabled={disabled}
          accessibilityLabel={COPY.removeSpoken(member.name)}
          accessibilityHint={COPY.removeHint}
          style={styles.action}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  details: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  fill: {
    flex: 1,
  },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shrinks: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Equal halves side by side, as on the address book; each wraps to a full row when it cannot fit.
  action: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '40%',
  },
});

export const TeamMemberCard = memo(TeamMemberCardComponent);
