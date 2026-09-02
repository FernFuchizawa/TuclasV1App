import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BottomNavBarProps {
  activeTab: 'home' | 'bookings' | 'maps' | 'profile';
  onNavigateTab: (tab: string) => void;
}

interface NavItemConfig {
  key: 'home' | 'bookings' | 'maps' | 'profile';
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

const NAV_ITEMS: NavItemConfig[] = [
  { key: 'home', label: 'Home', activeIcon: 'home', inactiveIcon: 'home-outline' },
  { key: 'bookings', label: 'Bookings', activeIcon: 'calendar', inactiveIcon: 'calendar-outline' },
  { key: 'maps', label: 'Maps', activeIcon: 'map', inactiveIcon: 'map-outline' },
  { key: 'profile', label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline' },
];

function NavItemButton({
  item,
  isActive,
  onPress,
}: {
  item: NavItemConfig;
  isActive: boolean;
  onPress: () => void;
}) {
  const swingAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(isActive ? 1.08 : 1)).current;

  useEffect(() => {
    if (isActive) {
      // Swing animation
      swingAnim.setValue(0);
      Animated.sequence([
        Animated.timing(swingAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(swingAnim, { toValue: 2, duration: 90, useNativeDriver: true }),
        Animated.timing(swingAnim, { toValue: 3, duration: 90, useNativeDriver: true }),
        Animated.timing(swingAnim, { toValue: 4, duration: 90, useNativeDriver: true }),
        Animated.timing(swingAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]).start();

      // Subtle lift scale
      Animated.spring(scaleAnim, {
        toValue: 1.08,
        friction: 5,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  const rotation = swingAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: ['0deg', '-15deg', '12deg', '-6deg', '0deg'],
  });

  return (
    <TouchableOpacity
      style={styles.navItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Animated Icon with Swing & Scale */}
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            transform: [{ rotate: rotation }, { scale: scaleAnim }],
          },
        ]}
      >
        <Ionicons
          name={isActive ? item.activeIcon : item.inactiveIcon}
          size={24}
          color={isActive ? '#0284c7' : '#94a3b8'}
        />
      </Animated.View>

      {/* Label */}
      <Text
        style={[
          styles.navLabel,
          isActive ? styles.labelActive : styles.labelInactive,
        ]}
      >
        {item.label}
      </Text>

      {/* Minimalist Active Indicator Dot */}
      <View
        style={[
          styles.activeDot,
          isActive ? styles.activeDotVisible : styles.activeDotHidden,
        ]}
      />
    </TouchableOpacity>
  );
}

export default function BottomNavBar({ activeTab, onNavigateTab }: BottomNavBarProps) {
  return (
    <View style={styles.bottomNavContainer}>
      {NAV_ITEMS.map((item) => (
        <NavItemButton
          key={item.key}
          item={item}
          isActive={activeTab === item.key}
          onPress={() => onNavigateTab(item.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 82 : 68,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 4,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 11,
    marginTop: 3,
    letterSpacing: -0.2,
  },
  labelActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  labelInactive: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  activeDotVisible: {
    backgroundColor: '#0284c7',
  },
  activeDotHidden: {
    backgroundColor: 'transparent',
  },
});