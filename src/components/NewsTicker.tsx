import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  LayoutChangeEvent,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NewsTickerProps {
  condition: string;
  message: string;
}

export default function NewsTicker({ condition, message }: NewsTickerProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (containerWidth <= 0 || textWidth <= 0) return;

    animatedValue.setValue(containerWidth);

    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: -textWidth,
        duration: Math.max(9000, (containerWidth + textWidth) * 22),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();
  }, [containerWidth, textWidth, condition, message]);

  return (
    <>
      {/* Clickable Ticker Bar */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setModalVisible(true)}
        style={styles.container}
        onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.marqueeMask}>
          <Animated.View
            style={[
              styles.animatedRow,
              { transform: [{ translateX: animatedValue }] },
            ]}
          >
            <Text
              style={styles.tickerText}
              onLayout={(e: LayoutChangeEvent) => setTextWidth(e.nativeEvent.layout.width)}
              numberOfLines={1}
            >
              🌊 Sea Condition: <Text style={styles.boldText}>{condition}</Text>
              {'   '}•{'   '}
              📢 Advisory: {message}
              {'   '}•{'   '}
              ☀️ Calatrava MDRRMO Live Advisory (Tap to view)
            </Text>
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Full Advisory Details Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={24} color="#0284c7" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Official Sea Advisory</Text>
                <Text style={styles.modalSubtitle}>Calatrava MDRRMO / Coast Guard</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.conditionCard}>
              <Text style={styles.conditionLabel}>Current Status</Text>
              <Text style={styles.conditionValue}>🌊 {condition}</Text>
            </View>

            <View style={styles.messageBox}>
              <Text style={styles.messageLabel}>Advisory Broadcast</Text>
              <Text style={styles.messageContent}>{message || 'No additional safety notices at this time.'}</Text>
            </View>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.dismissBtnText}>Understood</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 38,
    backgroundColor: '#0284c7',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  marqueeMask: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  animatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  boldText: {
    color: '#fef08a',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  closeButton: {
    padding: 4,
  },
  conditionCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  conditionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  conditionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0369a1',
  },
  messageBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  dismissBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});