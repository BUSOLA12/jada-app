import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';

const CATEGORIES = ['ECONOMY', 'PREMIUM', 'XL'];

const CategorySelectScreen = ({ navigation, route }) => {
  const selectedCategory = String(route?.params?.selectedCategory || '').toUpperCase();

  const handleSelect = (category) => {
    navigation.navigate('VehicleAdd', { selectedCategory: category });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Select Vehicle Category</Text>
        <Text style={styles.subtitle}>Choose the category you want to drive with.</Text>

        {CATEGORIES.map((category) => {
          const selected = category === selectedCategory;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => handleSelect(category)}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    ...SHADOWS.small,
  },
  title: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    marginBottom: 14,
    color: COLORS.textSecondary,
  },
  option: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: COLORS.teal,
    backgroundColor: `${COLORS.teal}14`,
  },
  optionText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: COLORS.teal,
  },
});

export default CategorySelectScreen;
