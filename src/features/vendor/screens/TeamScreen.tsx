import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';

import type { VendorStackParamList, VendorTabParamList } from '@/app/navigation/types';
import { Avatar, Badge, EmptyState, ErrorState, Icon, ListGroup, ListItem, PrimaryButton, Row, Screen, ScreenLoader, Text } from '@/shared/components';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { strings } from '@/shared/i18n/strings';
import { teamApi } from '@/shared/services/api';
import { type ColorTone } from '@/shared/theme';
import type { TeamMemberStatus } from '@/shared/types/models';
import { formatPhone } from '@/shared/utils/format';

type Props = CompositeScreenProps<BottomTabScreenProps<VendorTabParamList, 'Team'>, NativeStackScreenProps<VendorStackParamList>>;

const STATUS: Record<TeamMemberStatus, { label: string; tone: ColorTone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  ON_LEAVE: { label: 'On leave', tone: 'warning' },
  INACTIVE: { label: 'Disabled', tone: 'neutral' },
};

/** Compact roster; tapping a member opens their details, where status and removal live. */
export function TeamScreen({ navigation }: Props) {
  const query = useServiceQuery(() => teamApi.list(), []);
  useRefreshOnFocus(query.refresh);

  if (query.isLoading) return <ScreenLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.retry} />;
  const members = query.data ?? [];
  const active = members.filter(m => m.status === 'ACTIVE').length;

  return (
    <Screen
      testID="team-screen"
      refreshing={query.isRefreshing}
      onRefresh={query.refresh}
      footer={members.length ? <PrimaryButton testID="team-add" label="Add team member" icon="add" onPress={() => navigation.navigate('TeamMemberForm')} /> : null}>
      {members.length === 0 ? (
        <EmptyState icon="team" title={strings.empty.team} message="Add the technicians you assign to jobs." actionLabel="Add team member" onAction={() => navigation.navigate('TeamMemberForm')} testID="team-empty" />
      ) : (
        <>
          <Text variant="caption" color="textSecondary">
            {members.length} {members.length === 1 ? 'member' : 'members'} · {active} available for jobs
          </Text>
          <ListGroup testID="team-list">
            {members.map(member => (
              <ListItem
                key={member.id}
                testID={`team-member-${member.name}`}
                accessibilityLabel={`${member.name}, ${member.designation}, ${STATUS[member.status].label}`}
                leading={<Avatar name={member.name} uri={member.profileImage} />}
                title={member.name}
                subtitle={`${member.designation} · ${formatPhone(member.phone)}`}
                onPress={() => navigation.navigate('TeamMemberForm', { member })}
                trailing={
                  <Row gap="sm">
                    <Badge label={STATUS[member.status].label} tone={STATUS[member.status].tone} />
                    <Icon name="forward" size="md" color="textTertiary" />
                  </Row>
                }
              />
            ))}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}
