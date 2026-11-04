import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function NewAppScreen({ templateFileName }: { templateFileName?: string; safeAreaInsets?: any }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fixora Marketplace</Text>
      <Text style={styles.subtitle}>Mobile Application</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚀 Environment Ready</Text>
        <Text style={styles.cardBody}>
          React Native Web runner is active. Backend API connection configured.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#38BDF8',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 400,
    width: '100%',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
});
