import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink, X } from 'lucide-react-native';
import Video from 'react-native-video';
import type { CompanyMediaFile } from '../../services/mediaService';
import { getSessionHeaders } from '../../services/httpClient';

/**
 * Full-screen viewer for a single media file.
 *
 * Images and videos open in here instead of being handed to the system
 * browser: a brand video is part of the employee workflow, and bouncing out to
 * Safari drops the session and the navigation stack on the way back.
 *
 * PDFs and Brand Locations still defer to the OS — neither has a native
 * renderer, and both open sensibly elsewhere.
 */

interface Props {
  file: CompanyMediaFile | null;
  onClose: () => void;
}

export function MediaViewer({ file, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Images need a zoom surface; scrolling is meaningless for video controls.
  const zoomRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const close = () => {
    setLoading(true);
    setFailed(false);
    onClose();
  };

  const openExternally = () => {
    if (!file) {
      return;
    }
    void Linking.openURL(file.url);
  };

  const isImage = file?.kind === 'image';
  const isVideo = file?.kind === 'video';

  return (
    <Modal
      visible={file !== null}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent>
      <View className="flex-1" style={s.backdrop}>
        {/* ---------- Header ---------- */}
        <View
          className="flex-row items-center gap-3 px-4"
          style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}>
          <View className="flex-1">
            <Text
              className="font-lato-bold text-sm text-white"
              numberOfLines={1}>
              {file?.optionName || file?.fileName || 'Media'}
            </Text>
            {file?.fileName ? (
              <Text
                className="font-lato text-[11px] text-white/70 mt-0.5"
                numberOfLines={1}>
                {file.fileName}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openExternally}
            className="w-9 h-9 rounded-full bg-white/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Open in external app">
            <ExternalLink size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={close}
            className="w-9 h-9 rounded-full bg-white/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Close viewer">
            <X size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ---------- Body ---------- */}
        <View className="flex-1">
          {isImage ? (
            <ScrollView
              ref={zoomRef}
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom
              horizontal
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                width,
                height,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Image
                source={{ uri: file!.url, headers: getSessionHeaders() }}
                style={{ width, height }}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
            </ScrollView>
          ) : isVideo ? (
            <Video
              source={{ uri: file!.url, headers: getSessionHeaders() }}
              style={{ width, height }}
              controls
              resizeMode="contain"
              paused={false}
              repeat={false}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          ) : null}

          {loading && !failed ? (
            <View style={s.overlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : null}

          {failed ? (
            <View style={s.overlay}>
              <Text className="font-lato-bold text-base text-white mb-1">
                Could not load this file
              </Text>
              <Text className="font-lato text-xs text-white/70 text-center mt-1 mb-4">
                The link may be expired, or the file may need a connection the
                server cannot reach.
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={openExternally}
                className="bg-white/15 rounded-2xl px-5 py-3"
                accessibilityRole="button"
                accessibilityLabel="Open in external app">
                <Text className="font-lato-bold text-sm text-white">
                  Try opening it externally
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {isImage ? (
          <View style={{ paddingBottom: insets.bottom + 10 }} pointerEvents="none">
            <Text className="font-lato text-[11px] text-white/50 text-center">
              Pinch to zoom · double tap to reset
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 26, 0.97)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});