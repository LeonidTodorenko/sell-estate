import React, { useCallback, useMemo } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';

export type ImageGalleryItem =
  | string
  | {
      uri: string;
      id?: string;
      title?: string;
    };

type ImageGalleryModalProps = {
  visible: boolean;
  images: ImageGalleryItem[];
  imageIndex?: number;
  onRequestClose: () => void;
  onImageIndexChange?: (index: number) => void;
};

type GalleryHeaderProps = {
  imageIndex: number;
  imagesCount: number;
  onClose: () => void;
};

const GalleryHeader = ({
  imageIndex,
  imagesCount,
  onClose,
}: GalleryHeaderProps) => {
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.headerSafeArea}>
      <View pointerEvents="box-none" style={styles.header}>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {imageIndex + 1} / {imagesCount}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Close image gallery"
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

/**
 * Общая полноэкранная галерея для всего приложения.
 *
 * Возможности:
 * - горизонтальный свайп между изображениями;
 * - pinch-to-zoom;
 * - double tap zoom;
 * - swipe down для закрытия;
 * - Android Back;
 * - всегда видимая кнопка закрытия;
 * - счётчик текущего изображения.
 *
 * В images можно передавать как строки URI, так и объекты:
 * [{ uri, id, title }].
 */
const ImageGalleryModal = ({
  visible,
  images,
  imageIndex = 0,
  onRequestClose,
  onImageIndexChange,
}: ImageGalleryModalProps) => {
  const normalizedImages = useMemo(
    () =>
      images
        .map((image) => {
          const uri =
            typeof image === 'string'
              ? image.trim()
              : image.uri?.trim();

          if (!uri) {
            return null;
          }

          return {
            uri,
          };
        })
        .filter((image): image is { uri: string } => image !== null),
    [images],
  );

  const safeImageIndex =
    normalizedImages.length === 0
      ? 0
      : Math.min(Math.max(imageIndex, 0), normalizedImages.length - 1);

  const renderHeader = useCallback(
    ({ imageIndex: currentIndex }: { imageIndex: number }) => (
      <GalleryHeader
        imageIndex={currentIndex}
        imagesCount={normalizedImages.length}
        onClose={onRequestClose}
      />
    ),
    [normalizedImages.length, onRequestClose],
  );

  if (normalizedImages.length === 0) {
    return null;
  }

  return (
    <ImageViewing
      images={normalizedImages}
      imageIndex={safeImageIndex}
      visible={visible}
      onRequestClose={onRequestClose}
      onImageIndexChange={onImageIndexChange}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      presentationStyle="fullScreen"
      animationType="fade"
      backgroundColor="#000000"
      HeaderComponent={renderHeader}
    />
  );
};

const styles = StyleSheet.create({
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 10000,
    elevation: 10000,
  },

  header: {
    minHeight: Platform.OS === 'android' ? 72 : 56,
    paddingTop: Platform.OS === 'android' ? 18 : 4,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  counter: {
    minWidth: 58,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 27,
  },
});

export default ImageGalleryModal;
