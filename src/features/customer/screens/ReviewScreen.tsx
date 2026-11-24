import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { Banner, ImageUploader, PrimaryButton, RatingStars, Screen, Text, TextField, useToast } from '@/shared/components';
import { useImageUploads } from '@/shared/hooks/useImageUploads';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { reviewApi } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { useTheme } from '@/shared/theme';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Review'>;

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function ReviewScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { requestId, vendorName, requestNumber } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingError, setRatingError] = useState<string | null>(null);
  const uploads = useImageUploads('REVIEW', [], 3);
  const submit = useServiceMutation(reviewApi.create);

  const onSubmit = async () => {
    if (rating < 1) {
      setRatingError('Please choose a rating.');
      return;
    }
    const review = await submit.mutate({ serviceRequestId: requestId, rating, comment: comment.trim(), images: uploads.urls });
    if (review) {
      Analytics.track('review_submitted', { rating });
      toast.show('Thanks! Your review has been submitted.');
      navigation.goBack();
    }
  };

  return (
    <Screen
      testID="review-screen"
      footer={<PrimaryButton testID="review-submit" label="Submit review" onPress={onSubmit} loading={submit.isSubmitting} disabled={uploads.isBusy || uploads.hasFailures} />}>
      <Text variant="h2">How was {vendorName}?</Text>
      <Text variant="caption" color="textSecondary">
        Request {requestNumber}. Reviews can't be edited after submission.
      </Text>
      {submit.error ? <Banner tone="danger" icon="error" message={submit.error.userMessage} /> : null}
      <View style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}>
        <RatingStars
          value={rating}
          size={40}
          onChange={value => {
            setRating(value);
            setRatingError(null);
          }}
        />
        <Text variant="bodyStrong" color={ratingError ? 'danger' : 'textSecondary'}>
          {ratingError ?? (LABELS[rating] || 'Tap to rate')}
        </Text>
      </View>
      <TextField testID="review-comment" label="Comment" optional multiline value={comment} onChangeText={setComment} placeholder="Tell others about the service" maxLength={1000} />
      <Text variant="label" color="textSecondary">
        Photos <Text variant="caption" color="textTertiary">(optional)</Text>
      </Text>
      <ImageUploader controller={uploads} testID="review-uploader" />
    </Screen>
  );
}
