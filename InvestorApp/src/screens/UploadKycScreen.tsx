import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import api from '../api';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

import buttonIcon from '../assets/images/kyc_button_icon.png';
import confirmedIcon from '../assets/images/kyc_Icon_big2.png';
import submittedIcon from '../assets/images/kyc_icon_big.png';
import doneCircleIcon from '../assets/images/kyc_done.png';
import uploadIcon from '../assets/images/kyc_upload.png';
import radioOffIcon from '../assets/images/kyc_radio_button.png';
import radioOnIcon from '../assets/images/kyc_radio_button2.png';
import rightIcon from '../assets/images/kyc_right_m.png';

type DocTypeOption = 'passport' | 'driver_license';
type StepKey = 'main' | 'selfie';

interface KycDoc {
  id: string;
  userId?: string;
  type: string;
  base64File: string;
  status: string;
  uploadedAt: string;
}

const DOC_TYPE_LABELS: Record<DocTypeOption, string> = {
  passport: 'Passport',
  driver_license: "Driver's License",
};

const UploadKycScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [docType, setDocType] = useState<DocTypeOption>('passport');

  const [mainBase64, setMainBase64] = useState<string | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);

  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [selectedStep, setSelectedStep] = useState<StepKey | null>(null);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchDocs = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;

      const user = JSON.parse(stored);
      const res = await api.get(`/kyc/user/${user.userId}`);
      setDocs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('fetchDocs error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const latestDocsOfCurrentType = useMemo(() => {
    return [...docs]
      .filter((d) => d.type === docType)
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )
      .slice(0, 2)
      .reverse();
  }, [docs, docType]);

  const currentMainDoc = latestDocsOfCurrentType[0] ?? null;
  const currentSelfieDoc = latestDocsOfCurrentType[1] ?? null;

  const hasApproved = useMemo(() => {
    return (
      latestDocsOfCurrentType.length === 2 &&
      latestDocsOfCurrentType.every((d) => d.status === 'approved')
    );
  }, [latestDocsOfCurrentType]);

  const hasPending = useMemo(() => {
    return (
      latestDocsOfCurrentType.length === 2 &&
      latestDocsOfCurrentType.some((d) => d.status === 'pending')
    );
  }, [latestDocsOfCurrentType]);

  const hasRejected = useMemo(() => {
    return (
      latestDocsOfCurrentType.length === 2 &&
      latestDocsOfCurrentType.some((d) => d.status === 'rejected')
    );
  }, [latestDocsOfCurrentType]);

  const canSubmit =
    !submitting &&
    !hasPending &&
    !hasApproved &&
    !!mainBase64 &&
    !!selfieBase64;

  const openSourcePicker = (step: StepKey) => {
    if (hasPending || hasApproved) return;
    setSelectedStep(step);
    setSourceModalVisible(true);
  };

  const setImageToStep = (base64: string | null) => {
    if (!base64 || !selectedStep) return;

    if (selectedStep === 'main') {
      setMainBase64(base64);
    } else {
      setSelfieBase64(base64);
    }
  };

  const openPreview = (base64?: string | null) => {
    if (!base64) return;
    setPreviewImage(base64);
    setPreviewVisible(true);
  };

  const pickFromGallery = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.85,
      });

      if (res.assets?.length) {
        setImageToStep(res.assets[0].base64 || null);
      }
    } catch (err) {
      console.error('pickFromGallery error', err);
    } finally {
      setSourceModalVisible(false);
    }
  };

  const takePhoto = async () => {
    try {
      const res = await launchCamera({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.85,
        saveToPhotos: false,
      });

      if (res.assets?.length) {
        setImageToStep(res.assets[0].base64 || null);
      }
    } catch (err) {
      console.error('takePhoto error', err);
    } finally {
      setSourceModalVisible(false);
    }
  };

  const upload = async () => {
    try {
      if (!mainBase64 || !selfieBase64) {
        Alert.alert('Error', 'Please upload both documents.');
        return;
      }

      setSubmitting(true);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        Alert.alert('Error', 'User session not found');
        return;
      }

      const user = JSON.parse(stored);

      await api.post('/kyc/upload', {
        userId: user.userId,
        type: docType,
        base64File: mainBase64,
        status: 'pending',
      });

      await api.post('/kyc/upload', {
        userId: user.userId,
        type: docType,
        base64File: selfieBase64,
        status: 'pending',
      });

      setMainBase64(null);
      setSelfieBase64(null);

      await fetchDocs();
    } catch (err) {
      console.error('upload error', err);
      Alert.alert('Error', 'Failed to upload documents.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRightIcon = (
    status: 'empty' | 'ready' | 'pending' | 'approved' | 'rejected'
  ) => {
    if (status === 'approved') {
      return (
        <Image
          source={doneCircleIcon}
          style={styles.rightStatusCircle}
          resizeMode="contain"
        />
      );
    }

    if (status === 'pending') {
      return <View style={styles.pendingDot} />;
    }

    if (status === 'rejected') {
      return <Text style={styles.rejectedMark}>!</Text>;
    }

    if (status === 'ready') {
      return <Text style={styles.readyCheck}>✓</Text>;
    }

    return (
      <Image
        source={rightIcon}
        style={styles.rightArrowIcon}
        resizeMode="contain"
      />
    );
  };

  const getStepStatus = (
    step: StepKey
  ): 'empty' | 'ready' | 'pending' | 'approved' | 'rejected' => {
    const doc = step === 'main' ? currentMainDoc : currentSelfieDoc;
    const localBase64 = step === 'main' ? mainBase64 : selfieBase64;

    if (localBase64) return 'ready';
    if (doc?.status === 'approved') return 'approved';
    if (doc?.status === 'pending') return 'pending';
    if (doc?.status === 'rejected') return 'rejected';

    return 'empty';
  };

  const handleSelectDocType = (type: DocTypeOption) => {
    setDocType(type);
    setMainBase64(null);
    setSelfieBase64(null);
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>

        <Text style={styles.topHeaderTitle}>Identity Verification</Text>

        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!hasPending && !hasApproved ? (
          <View style={styles.card}>
            <Text style={styles.mainTitle}>
              To verify your identity, please upload the following:
            </Text>

            {hasRejected && (
              <View style={styles.rejectedBanner}>
                <Text style={styles.rejectedBannerText}>
                  Some documents were rejected. Please upload them again.
                </Text>
              </View>
            )}

            <Pressable
              style={styles.docTypeBox}
              onPress={() => setTypeModalVisible(true)}
            >
              <View>
                <Text style={styles.docTypeLabel}>Document type</Text>
                <Text style={styles.docTypeValue}>
                  {DOC_TYPE_LABELS[docType]}
                </Text>
              </View>

              <Image
                source={rightIcon}
                style={styles.docTypeArrow}
                resizeMode="contain"
              />
            </Pressable>

            <Pressable
              style={styles.stepRow}
              onPress={() => openSourcePicker('main')}
            >
              <View style={styles.iconCircle}>
                <Image
                  source={buttonIcon}
                  style={styles.stepIcon}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.stepTextWrap}>
                <Text style={styles.stepCaption}>Step 1</Text>
                <Text style={styles.stepTitle}>Passport (main page)</Text>
              </View>

              <View style={styles.stepRightWrap}>
                {mainBase64 ? (
                  <Pressable
                    onPress={() => openPreview(mainBase64)}
                    style={styles.previewThumbWrap}
                  >
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${mainBase64}` }}
                      style={styles.previewThumb}
                    />
                  </Pressable>
                ) : (
                  renderRightIcon(getStepStatus('main'))
                )}
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={styles.stepRow}
              onPress={() => openSourcePicker('selfie')}
            >
              <View style={styles.iconCircle}>
                <Image
                  source={buttonIcon}
                  style={styles.stepIcon}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.stepTextWrap}>
                <Text style={styles.stepCaption}>Step 2</Text>
                <Text style={styles.stepTitle}>Selfie with passport</Text>
              </View>

              <View style={styles.stepRightWrap}>
                {selfieBase64 ? (
                  <Pressable
                    onPress={() => openPreview(selfieBase64)}
                    style={styles.previewThumbWrap}
                  >
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${selfieBase64}` }}
                      style={styles.previewThumb}
                    />
                  </Pressable>
                ) : (
                  renderRightIcon(getStepStatus('selfie'))
                )}
              </View>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <Image
                source={hasApproved ? confirmedIcon : submittedIcon}
                style={styles.bigStatusIcon}
                resizeMode="contain"
              />

              <Text style={styles.statusTitle}>
                {hasApproved
                  ? 'Your identity has been confirmed!'
                  : 'Documents Submitted!'}
              </Text>

              <Text style={styles.statusText}>
                {hasApproved
                  ? 'All platform features are available.'
                  : 'Your documents have been sent for review. This usually takes up to 24 hours. We’ll notify you once the verification is complete.'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.uploadedTitle}>Uploaded documents:</Text>

              <View style={styles.stepRowReadonly}>
                <View style={styles.iconCircle}>
                  <Image
                    source={buttonIcon}
                    style={styles.stepIcon}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepCaption}>Step 1</Text>
                  <Text style={styles.stepTitle}>Passport (main page)</Text>
                </View>

                <View style={styles.stepRightWrap}>
                  {hasApproved ? (
                    <Image
                      source={doneCircleIcon}
                      style={styles.rightStatusCircle}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.pendingDot} />
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.stepRowReadonly}>
                <View style={styles.iconCircle}>
                  <Image
                    source={buttonIcon}
                    style={styles.stepIcon}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepCaption}>Step 2</Text>
                  <Text style={styles.stepTitle}>Selfie with passport</Text>
                </View>

                <View style={styles.stepRightWrap}>
                  {hasApproved ? (
                    <Image
                      source={doneCircleIcon}
                      style={styles.rightStatusCircle}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.pendingDot} />
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomButtonWrap}>
        {hasPending || hasApproved ? (
          <BlueButton
            title="Back to Profile"
            onPress={() => navigation.goBack()}
            width="full"
            bgColor={theme.colors.primary}
            textColor={theme.colors.white}
            borderColor={theme.colors.primary}
            paddingVertical={14}
          />
        ) : (
          <BlueButton
            title={submitting ? 'Submitting...' : 'Submit for Review'}
            onPress={upload}
            width="full"
            disabled={!canSubmit}
            bgColor={canSubmit ? theme.colors.primary : '#A8DDC8'}
            textColor={theme.colors.white}
            borderColor="transparent"
            paddingVertical={14}
          />
        )}
      </View>

      <Modal
        visible={sourceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSourceModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSourceModalVisible(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              {selectedStep === 'main'
                ? 'Passport (main page)'
                : 'Selfie with passport'}
            </Text>

            <View style={styles.sheetDivider} />

            <Pressable style={styles.sheetRow} onPress={takePhoto}>
              <View style={styles.sheetRowLeft}>
                <Image
                  source={buttonIcon}
                  style={styles.sheetRowIcon}
                  resizeMode="contain"
                />
                <Text style={styles.sheetRowText}>Take Photo</Text>
              </View>
              <Image
                source={rightIcon}
                style={styles.sheetArrow}
                resizeMode="contain"
              />
            </Pressable>

            <View style={styles.sheetDivider} />

            <Pressable style={styles.sheetRow} onPress={pickFromGallery}>
              <View style={styles.sheetRowLeft}>
                <Image
                  source={uploadIcon}
                  style={styles.sheetRowIcon}
                  resizeMode="contain"
                />
                <Text style={styles.sheetRowText}>Choose from Gallery</Text>
              </View>
              <Image
                source={rightIcon}
                style={styles.sheetArrow}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={typeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setTypeModalVisible(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select document type</Text>

            <View style={styles.sheetDivider} />

            <Pressable
              style={styles.radioRow}
              onPress={() => handleSelectDocType('passport')}
            >
              <View style={styles.radioRowLeft}>
                <Image
                  source={docType === 'passport' ? radioOnIcon : radioOffIcon}
                  style={styles.radioIcon}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.radioTitle}>Passport</Text>
                  <Text style={styles.radioSubtitle}>
                    International or local
                  </Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              style={styles.radioRow}
              onPress={() => handleSelectDocType('driver_license')}
            >
              <View style={styles.radioRowLeft}>
                <Image
                  source={
                    docType === 'driver_license' ? radioOnIcon : radioOffIcon
                  }
                  style={styles.radioIcon}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.radioTitle}>Driver&apos;s License</Text>
                  <Text style={styles.radioSubtitle}>
                    International or local
                  </Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.sheetButtonsRow}>
              <BlueButton
                title="Cancel"
                onPress={() => setTypeModalVisible(false)}
                bgColor="#F3F4F6"
                textColor={theme.colors.text}
                borderColor="#F3F4F6"
                style={styles.sheetButton}
                paddingVertical={14}
              />

              <BlueButton
                title="Continue"
                onPress={() => setTypeModalVisible(false)}
                bgColor={theme.colors.primary}
                textColor={theme.colors.white}
                borderColor={theme.colors.primary}
                style={styles.sheetButton}
                paddingVertical={14}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable
            style={styles.previewOverlay}
            onPress={() => setPreviewVisible(false)}
          />

          <View style={styles.previewCard}>
            {!!previewImage && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${previewImage}` }}
                style={styles.previewLargeImage}
                resizeMode="contain"
              />
            )}

            <BlueButton
              title="Close"
              onPress={() => setPreviewVisible(false)}
              width="full"
              bgColor={theme.colors.primary}
              textColor={theme.colors.white}
              borderColor={theme.colors.primary}
              paddingVertical={12}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default UploadKycScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  loaderWrap: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },

  backArrow: {
    fontSize: 28,
    lineHeight: 28,
    color: theme.colors.text,
  },

  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },

  content: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },

  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 18,
    paddingBottom: 20,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },

  bigStatusIcon: {
    width: 118,
    height: 118,
    marginBottom: 14,
  },

  statusTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },

  statusText: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
    textAlign: 'center',
  },

  mainTitle: {
    fontSize: 21,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 22,
  },

  uploadedTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },

  rejectedBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },

  rejectedBannerText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  docTypeBox: {
    minHeight: 64,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  docTypeLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },

  docTypeValue: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text,
  },

  docTypeArrow: {
    width: 16,
    height: 16,
    tintColor: '#A3A3A3',
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },

  stepRowReadonly: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },

  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  stepIcon: {
    width: 22,
    height: 22,
  },

  stepTextWrap: {
    flex: 1,
  },

  stepCaption: {
    fontSize: 14,
    color: '#A3A3A3',
    marginBottom: 4,
  },

  stepTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
  },

  stepRightWrap: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  rightArrowIcon: {
    width: 12,
    height: 16,
    tintColor: '#A3A3A3',
  },

  rightStatusCircle: {
    width: 22,
    height: 22,
  },

  pendingDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#C9C9C9',
  },

  readyCheck: {
    fontSize: 24,
    lineHeight: 24,
    color: theme.colors.text,
  },

  rejectedMark: {
    fontSize: 24,
    lineHeight: 24,
    color: theme.colors.danger,
    fontWeight: '700',
  },

  previewThumbWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: 'hidden',
  },

  previewThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },

  divider: {
    height: 1,
    backgroundColor: '#ECECEC',
    marginLeft: 60,
  },

  bottomButtonWrap: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: 18,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },

  modalOverlay: {
    flex: 1,
  },

  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 24,
  },

  sheetHandle: {
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#BDBDBD',
    alignSelf: 'center',
    marginBottom: 16,
  },

  sheetTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 14,
  },

  sheetDivider: {
    height: 1,
    backgroundColor: '#ECECEC',
  },

  sheetRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sheetRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sheetRowIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },

  sheetRowText: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
  },

  sheetArrow: {
    width: 12,
    height: 16,
    tintColor: '#A3A3A3',
  },

  radioRow: {
    paddingVertical: 12,
  },

  radioRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  radioIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    marginTop: 1,
  },

  radioTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text,
  },

  radioSubtitle: {
    marginTop: 2,
    fontSize: 15,
    color: '#9CA3AF',
  },

  sheetButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  sheetButton: {
    flex: 1,
    marginBottom: 0,
    shadowOpacity: 0,
    elevation: 0,
    borderRadius: 14,
  },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  previewCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
  },

  previewLargeImage: {
    width: '100%',
    height: 360,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
  },
});