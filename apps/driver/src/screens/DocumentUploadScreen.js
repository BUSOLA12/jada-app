import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import storage from '@react-native-firebase/storage';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import Button from '../components/common/Button';
import AlertOverlay from '../components/common/AlertOverlay';
import StatusBadge from '../components/onboarding/StatusBadge';
import {
  pickImageDocumentFromCamera,
  pickImageDocumentFromLibrary,
} from '../services/driverOnboardingService';

const DOCUMENT_LABELS = {
  LICENSE: "Driver's License",
  GOV_ID: 'Government ID',
  PROFILE_PHOTO: 'Profile Photo',
  VEHICLE_REG: 'Vehicle Registration',
  INSURANCE: 'Insurance',
  ROADWORTHINESS: 'Roadworthiness',
};

const DOCUMENT_DESCRIPTIONS = {
  LICENSE: 'Upload your active driver license.',
  GOV_ID: 'Upload an official government-issued ID card.',
  PROFILE_PHOTO: 'Clear portrait photo of yourself.',
  VEHICLE_REG: 'Upload your vehicle registration document.',
  INSURANCE: 'Upload valid vehicle insurance document.',
  ROADWORTHINESS: 'Upload current roadworthiness certificate.',
};

const DOCUMENT_TYPES_WITH_EXPIRY = new Set([
  'LICENSE',
  'GOV_ID',
  'VEHICLE_REG',
  'INSURANCE',
  'ROADWORTHINESS',
]);

const isPdfLikeDocument = (documentItem = {}) => {
  const mimeType = String(documentItem?.mimeType || '').toLowerCase();
  if (mimeType === 'application/pdf') {
    return true;
  }

  const filePath = String(documentItem?.filePath || '').toLowerCase();
  const downloadUrl = String(documentItem?.downloadUrl || '').toLowerCase();
  return filePath.endsWith('.pdf') || downloadUrl.includes('.pdf');
};

const isValidIsoDate = (value) => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const [year, month, day] = text.split('-').map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const DocumentUploadScreen = ({ navigation }) => {
  const { driver, documentsByType, enums, uploadDocument } = useDriver();
  const [uploadingByType, setUploadingByType] = useState({});
  const [expiryByType, setExpiryByType] = useState({});
  const [previewLoadingByType, setPreviewLoadingByType] = useState({});
  const [previewState, setPreviewState] = useState({
    visible: false,
    url: '',
    title: '',
  });
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const documentTypes = useMemo(
    () => enums.REQUIRED_DOCUMENT_TYPES || [],
    [enums.REQUIRED_DOCUMENT_TYPES]
  );
  const driverStatus = String(driver?.status || '').toUpperCase();

  useEffect(() => {
    const nextValues = {};
    for (const type of documentTypes) {
      const existingExpiry = String(documentsByType?.[type]?.expiryDate || '').trim();
      if (existingExpiry) {
        nextValues[type] = existingExpiry;
      }
    }
    if (Object.keys(nextValues).length === 0) {
      return;
    }
    setExpiryByType((prev) => ({ ...nextValues, ...prev }));
  }, [documentTypes, documentsByType]);

  const canEditDocument = (documentItem) => {
    const status = String(documentItem?.status || '').toUpperCase();
    if (!documentItem?.filePath) return true;
    if (
      status === enums.DOCUMENT_STATUSES.REJECTED ||
      status === enums.DOCUMENT_STATUSES.EXPIRED
    ) {
      return true;
    }
    if (driverStatus !== enums.DRIVER_STATUSES.PENDING_REVIEW) return true;
    return false;
  };

  const isUploading = (type) => Boolean(uploadingByType?.[type]);
  const isPreviewLoading = (type) => Boolean(previewLoadingByType?.[type]);

  const resolveDownloadUrl = async (documentItem) => {
    if (documentItem?.downloadUrl) {
      return String(documentItem.downloadUrl).trim();
    }

    const filePath = String(documentItem?.filePath || '').trim();
    if (!filePath) {
      return '';
    }

    const reference = storage().ref(filePath);
    return reference.getDownloadURL();
  };

  const getValidatedExpiryDate = (type) => {
    const requiresExpiry = DOCUMENT_TYPES_WITH_EXPIRY.has(type);
    const expiryDate = String(expiryByType?.[type] || '').trim();

    if (!requiresExpiry) {
      return null;
    }
    if (!expiryDate) {
      throw new Error(
        `Enter expiry date for ${DOCUMENT_LABELS[type] || type} in YYYY-MM-DD format.`
      );
    }
    if (!isValidIsoDate(expiryDate)) {
      throw new Error('Use a valid date format: YYYY-MM-DD (example: 2028-06-30).');
    }
    return expiryDate;
  };

  const runDocumentUpload = async (type, pickAssetFn) => {
    if (isUploading(type)) {
      return;
    }

    let expiryDate = null;
    try {
      expiryDate = getValidatedExpiryDate(type);
    } catch (validationError) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Upload requirement',
        message: validationError?.message || 'Please complete required fields.',
      });
      return;
    }

    setUploadingByType((prev) => ({ ...prev, [type]: true }));
    try {
      const asset = await pickAssetFn();
      if (!asset) return;
      await uploadDocument({
        type,
        asset,
        expiryDate,
      });
      setAlertState({
        visible: true,
        type: 'success',
        title: 'Uploaded',
        message: `${DOCUMENT_LABELS[type] || type} uploaded successfully.`,
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Upload failed',
        message: error?.message || 'Unable to upload document.',
      });
    } finally {
      setUploadingByType((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    }
  };

  const handleUploadFromGallery = async (type) => {
    await runDocumentUpload(type, pickImageDocumentFromLibrary);
  };

  const handleUploadFromCamera = async (type) => {
    await runDocumentUpload(type, pickImageDocumentFromCamera);
  };

  const handlePreviewType = async (type, documentItem) => {
    if (!documentItem?.filePath && !documentItem?.downloadUrl) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'No document yet',
        message: `Upload ${DOCUMENT_LABELS[type] || type} before previewing.`,
      });
      return;
    }

    setPreviewLoadingByType((prev) => ({ ...prev, [type]: true }));
    try {
      const downloadUrl = await resolveDownloadUrl(documentItem);
      if (!downloadUrl) {
        throw new Error('Unable to load this document preview right now.');
      }

      if (isPdfLikeDocument(documentItem)) {
        const canOpen = await Linking.canOpenURL(downloadUrl);
        if (!canOpen) {
          throw new Error('Cannot open PDF preview on this device.');
        }
        await Linking.openURL(downloadUrl);
        return;
      }

      setPreviewState({
        visible: true,
        url: downloadUrl,
        title: DOCUMENT_LABELS[type] || type,
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Preview failed',
        message: error?.message || 'Unable to open document preview.',
      });
    } finally {
      setPreviewLoadingByType((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DOCUMENT UPLOAD</Text>
      </View>

      <View style={styles.sheet}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Documents Upload</Text>
          <Text style={styles.subtitle}>Accepted format: JPG, JPEG, PNG, PDF. Max size 5MB.</Text>

          {documentTypes.map((type) => {
            const item = documentsByType?.[type];
            const status = String(item?.status || enums.DOCUMENT_STATUSES.PENDING).toUpperCase();
            const locked = !canEditDocument(item);
            const hasUploadedFile = Boolean(item?.filePath || item?.downloadUrl);
            const requiresExpiry = DOCUMENT_TYPES_WITH_EXPIRY.has(type);
            const loading = isUploading(type);

            return (
              <View key={type} style={styles.docCard}>
                <View style={styles.docHeader}>
                  <View style={styles.docTitleWrap}>
                    <Text style={styles.docName}>{DOCUMENT_LABELS[type] || type}</Text>
                    <Text style={styles.docDescription}>
                      {DOCUMENT_DESCRIPTIONS[type] || 'Upload required document.'}
                    </Text>
                  </View>
                  <StatusBadge status={status} />
                </View>

                {requiresExpiry ? (
                  <View style={styles.expiryInputWrap}>
                    <Text style={styles.expiryLabel}>Expiry Date (YYYY-MM-DD)</Text>
                    <TextInput
                      value={String(expiryByType?.[type] || '')}
                      onChangeText={(text) =>
                        setExpiryByType((prev) => ({
                          ...prev,
                          [type]: text.trim(),
                        }))
                      }
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={COLORS.textLight}
                      editable={!loading}
                      style={styles.expiryInput}
                    />
                  </View>
                ) : null}

                {item?.expiryDate ? (
                  <Text style={styles.expiryText}>Saved expiry: {String(item.expiryDate)}</Text>
                ) : null}
                {item?.rejectionReason ? (
                  <Text style={styles.rejectionReason}>Reason: {item.rejectionReason}</Text>
                ) : null}
                {locked ? (
                  <Text style={styles.lockedText}>Locked while pending review.</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    disabled={locked || loading}
                    style={[styles.uploadButton, (locked || loading) && styles.disabledButton]}
                    onPress={() => handleUploadFromGallery(type)}
                  >
                    {loading ? (
                      <View style={styles.loadingContent}>
                        <ActivityIndicator size="small" color={COLORS.text} />
                        <Text style={styles.uploadButtonText}>Uploading...</Text>
                      </View>
                    ) : (
                      <View style={styles.loadingContent}>
                        <MaterialIcons name="upload-file" size={16} color={COLORS.text} />
                        <Text style={styles.uploadButtonText}>Upload file</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={locked || loading}
                    style={[styles.cameraButton, (locked || loading) && styles.disabledButton]}
                    onPress={() => handleUploadFromCamera(type)}
                  >
                    <View style={styles.loadingContent}>
                      <MaterialIcons name="photo-camera" size={16} color={COLORS.white} />
                      <Text style={styles.cameraButtonText}>Use camera</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {hasUploadedFile && (
                  <TouchableOpacity
                    disabled={loading || isPreviewLoading(type)}
                    style={styles.previewLink}
                    onPress={() => handlePreviewType(type, item)}
                  >
                    {isPreviewLoading(type) ? (
                      <View style={styles.loadingContent}>
                        <ActivityIndicator size="small" color={COLORS.teal} />
                        <Text style={styles.previewLinkText}>Opening preview...</Text>
                      </View>
                    ) : (
                      <Text style={styles.previewLinkText}>Preview uploaded file</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <Button
            title="Continue"
            onPress={() => navigation.navigate('VehicleAdd')}
            style={styles.submitButton}
          />
        </ScrollView>
      </View>

      <AlertOverlay
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState((prev) => ({ ...prev, visible: false }))}
      />

      <Modal
        visible={previewState.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewState({ visible: false, url: '', title: '' })}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{previewState.title}</Text>
            <Image source={{ uri: previewState.url }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewState({ visible: false, url: '', title: '' })}
            >
              <Text style={styles.previewCloseButtonText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8A826',
  },
  header: {
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.teal,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontSize: FONTS.sizes.large,
  },
  sheet: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.large,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: FONTS.sizes.large,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.small,
  },
  docCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  docTitleWrap: {
    flex: 1,
  },
  docName: {
    fontWeight: '700',
    color: COLORS.text,
  },
  docDescription: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.small,
  },
  expiryInputWrap: {
    marginTop: 10,
    gap: 6,
  },
  expiryLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.small,
  },
  expiryInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: COLORS.text,
  },
  expiryText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.small,
  },
  rejectionReason: {
    marginTop: 8,
    color: COLORS.error,
  },
  lockedText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#F3E7A3',
    paddingVertical: 10,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  cameraButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#F8A826',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cameraButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  previewLinkText: {
    color: COLORS.teal,
    fontWeight: '700',
    fontSize: FONTS.sizes.small,
  },
  submitButton: {
    marginTop: 6,
    backgroundColor: COLORS.teal,
    borderRadius: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
  },
  previewTitle: {
    fontSize: FONTS.sizes.regular,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: 10,
  },
  previewImage: {
    width: '100%',
    height: 360,
    resizeMode: 'contain',
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  previewCloseButton: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: COLORS.teal,
    paddingVertical: 11,
    alignItems: 'center',
  },
  previewCloseButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default DocumentUploadScreen;

