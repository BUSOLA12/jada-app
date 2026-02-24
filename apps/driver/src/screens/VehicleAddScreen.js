import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import Input from '../components/common/Input';
import AlertOverlay from '../components/common/AlertOverlay';
import {
  pickVehicleImageFromCamera,
  pickVehicleImageFromLibrary,
} from '../services/driverOnboardingService';

const VehicleAddScreen = ({ navigation, route }) => {
  const { vehicle, updateVehicle, uploadVehicleImage, enums } = useDriver();
  const [make, setMake] = useState(vehicle?.make || '');
  const [model, setModel] = useState(vehicle?.model || '');
  const [year, setYear] = useState(vehicle?.year || '');
  const [color, setColor] = useState(vehicle?.color || '');
  const [plate, setPlate] = useState(vehicle?.plate || '');
  const [category, setCategory] = useState(vehicle?.category || 'ECONOMY');
  const [saving, setSaving] = useState(false);
  const [uploadingBySlot, setUploadingBySlot] = useState({});
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const vehicleImageSlots = enums?.VEHICLE_IMAGE_SLOTS || {
    EXTERIOR: 'EXTERIOR',
    INTERIOR: 'INTERIOR',
    PLATE: 'PLATE',
  };
  const vehicleImageItems = [
    { slot: vehicleImageSlots.EXTERIOR, key: 'exterior', title: 'Exterior Photo' },
    { slot: vehicleImageSlots.INTERIOR, key: 'interior', title: 'Interior Photo' },
    { slot: vehicleImageSlots.PLATE, key: 'plate', title: 'Plate Photo' },
  ];

  const isUploadingSlot = (slot) => Boolean(uploadingBySlot?.[slot]);

  useEffect(() => {
    const selectedCategory = route?.params?.selectedCategory;
    if (selectedCategory) {
      setCategory(selectedCategory);
    }
  }, [route?.params?.selectedCategory]);

  const handleSave = async () => {
    if (!make.trim() || !model.trim() || !year.trim() || !color.trim() || !plate.trim()) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Missing details',
        message: 'Make, model, year, color, and plate are required.',
      });
      return;
    }

    setSaving(true);
    try {
      await updateVehicle({
        make: make.trim(),
        model: model.trim(),
        year: year.trim(),
        color: color.trim(),
        plate: plate.trim(),
        category,
      });
      setAlertState({
        visible: true,
        type: 'success',
        title: 'Saved',
        message: 'Vehicle details saved.',
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Save failed',
        message: error?.message || 'Unable to save vehicle details.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadVehicleImage = async (slot, source) => {
    if (isUploadingSlot(slot) || saving) {
      return;
    }

    setUploadingBySlot((prev) => ({ ...prev, [slot]: true }));
    try {
      const asset =
        source === 'camera'
          ? await pickVehicleImageFromCamera()
          : await pickVehicleImageFromLibrary();
      if (!asset) {
        return;
      }
      await uploadVehicleImage({ slot, asset });
      setAlertState({
        visible: true,
        type: 'success',
        title: 'Image uploaded',
        message: 'Vehicle image uploaded successfully.',
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Upload failed',
        message: error?.message || 'Unable to upload vehicle image.',
      });
    } finally {
      setUploadingBySlot((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Vehicle Details</Text>
          <Text style={styles.subtitle}>Add the vehicle used for driving.</Text>

          <Input label="Make" value={make} onChangeText={setMake} />
          <Input label="Model" value={model} onChangeText={setModel} />
          <Input label="Year" value={year} onChangeText={setYear} keyboardType="number-pad" />
          <Input label="Color" value={color} onChangeText={setColor} />
          <Input label="Plate Number" value={plate} onChangeText={setPlate} autoCapitalize="characters" />

          <View style={styles.imageSection}>
            <Text style={styles.imageSectionTitle}>Vehicle Images</Text>
            <Text style={styles.imageSectionHint}>Upload exterior, interior, and plate photos.</Text>

            {vehicleImageItems.map((item) => {
              const uploadedImage = vehicle?.images?.[item.key];
              const hasImage = Boolean(uploadedImage?.filePath || uploadedImage?.downloadUrl);
              const uploading = isUploadingSlot(item.slot);
              return (
                <View key={item.slot} style={styles.imageRow}>
                  <View style={styles.imageRowTextWrap}>
                    <Text style={styles.imageRowTitle}>{item.title}</Text>
                    <Text style={[styles.imageRowStatus, hasImage && styles.imageRowStatusDone]}>
                      {hasImage ? 'Uploaded' : 'Not uploaded'}
                    </Text>
                  </View>
                  <View style={styles.imageActionRow}>
                    <TouchableOpacity
                      style={[styles.imageUploadButton, uploading && styles.saveButtonDisabled]}
                      onPress={() => handleUploadVehicleImage(item.slot, 'gallery')}
                      disabled={uploading || saving}
                    >
                      {uploading ? (
                        <View style={styles.savingContent}>
                          <ActivityIndicator size="small" color={COLORS.white} />
                          <Text style={styles.imageUploadButtonText}>Uploading...</Text>
                        </View>
                      ) : (
                        <Text style={styles.imageUploadButtonText}>Gallery</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageCameraButton, uploading && styles.saveButtonDisabled]}
                      onPress={() => handleUploadVehicleImage(item.slot, 'camera')}
                      disabled={uploading || saving}
                    >
                      <Text style={styles.imageCameraButtonText}>{hasImage ? 'Camera' : 'Use Camera'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.categoryRow}
            onPress={() => navigation.navigate('CategorySelect', { selectedCategory: category })}
            disabled={saving}
          >
            <Text style={styles.categoryLabel}>Category</Text>
            <Text style={styles.categoryValue}>{category}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <View style={styles.savingContent}>
                <ActivityIndicator size="small" color={COLORS.white} />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>Save Vehicle</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, saving && styles.secondaryButtonDisabled]}
            onPress={() => navigation.navigate('Agreements')}
            disabled={saving}
          >
            <Text style={styles.secondaryButtonText}>Continue to Agreements</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AlertOverlay
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
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
  imageSection: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  imageSectionTitle: {
    fontWeight: '700',
    color: COLORS.text,
  },
  imageSectionHint: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.small,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  imageRowTextWrap: {
    flex: 1,
  },
  imageRowTitle: {
    color: COLORS.text,
    fontWeight: '600',
  },
  imageRowStatus: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.small,
    marginTop: 3,
  },
  imageRowStatusDone: {
    color: COLORS.success,
    fontWeight: '600',
  },
  imageUploadButton: {
    borderRadius: 10,
    backgroundColor: COLORS.teal,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 86,
    alignItems: 'center',
  },
  imageUploadButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  imageActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageCameraButton: {
    borderRadius: 10,
    backgroundColor: COLORS.orange,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 96,
    alignItems: 'center',
  },
  imageCameraButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  categoryRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: {
    color: COLORS.textSecondary,
  },
  categoryValue: {
    color: COLORS.text,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.teal,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  savingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});

export default VehicleAddScreen;
