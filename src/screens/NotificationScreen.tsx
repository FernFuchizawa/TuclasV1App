import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from '@expo/vector-icons';

interface NotificationScreenProps {
  onGoBack?: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface NotificationItem {
  id: string;
  type: 'pass' | 'weather' | 'booking' | 'promo';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  actionText?: string;
  targetTab?: string;
}

const NOTIFICATION_FILTERS = ['All', 'Trips & Passes', 'Weather & Sea', 'Promos'];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'weather',
    title: 'Sea Condition Advisory',
    message: 'Coast Guard advisory: Calm waters around Calatrava & Tablas. Safe for boat island hopping today.',
    time: '15 mins ago',
    isRead: false,
    actionText: 'View Sea Status',
    targetTab: 'home',
  },
  {
    id: '2',
    type: 'pass',
    title: 'Offline QR Pass Ready',
    message: 'Your boarding pass for Tinagong Dagat & Blue Hole (Boat #12) is downloaded and ready for offline use.',
    time: '1 hour ago',
    isRead: false,
    actionText: 'View Pass',
    targetTab: 'bookings',
  },
  {
    id: '3',
    type: 'booking',
    title: 'Booking Confirmed: Sunset Cove Resort',
    message: 'Your 1-night reservation for Deluxe Sea View Room is confirmed. Check-in starts at 2:00 PM.',
    time: 'Yesterday',
    isRead: true,
    actionText: 'Booking Details',
    targetTab: 'bookings',
  },
  {
    id: '4',
    type: 'promo',
    title: 'Exclusive Weekend Tour Discount',
    message: 'Get 15% off on motorized boat rentals when you book island day hopping passes in advance.',
    time: '2 days ago',
    isRead: true,
    actionText: 'Explore Tours',
    targetTab: 'activities',
  },
];

export default function NotificationScreen({ onGoBack, onNavigateTab }: NotificationScreenProps) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'weather':
        return <Ionicons name="sunny-outline" size={20} color="#0284c7" />;
      case 'pass':
        return <MaterialCommunityIcons name="qrcode-scan" size={20} color="#0284c7" />;
      case 'booking':
        return <MaterialCommunityIcons name="calendar-check" size={20} color="#16a34a" />;
      case 'promo':
        return <Ionicons name="pricetag-outline" size={20} color="#f59e0b" />;
      default:
        return <Ionicons name="notifications-outline" size={20} color="#0284c7" />;
    }
  };

  const filteredList = notifications.filter((item) => {
    if (selectedFilter === 'Trips & Passes') return item.type === 'pass' || item.type === 'booking';
    if (selectedFilter === 'Weather & Sea') return item.type === 'weather';
    if (selectedFilter === 'Promos') return item.type === 'promo';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <LinearGradient
      colors={['#0284c7', '#0ea5e9', '#38bdf8', '#bae6fd']}
      locations={[0, 0.22, 0.52, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" translucent />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onGoBack}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color="#0284c7" />
            </TouchableOpacity>

            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.markReadBtn}
                onPress={markAllAsRead}
                activeOpacity={0.8}
              >
                <Text style={styles.markReadText}>Mark all as read</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Title & Subtitle */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              Stay updated on trip passes, weather alerts & guides
            </Text>
          </View>

          {/* Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {NOTIFICATION_FILTERS.map((filter) => {
              const isSelected = selectedFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  style={[
                    styles.filterPill,
                    isSelected ? styles.filterPillActive : styles.filterPillInactive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected ? styles.filterPillTextActive : styles.filterPillTextInactive,
                    ]}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* White Bottom Notification Cards List */}
          <View style={styles.contentCard}>
            {filteredList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>You're all caught up for now!</Text>
              </View>
            ) : (
              <View style={styles.notificationList}>
                {filteredList.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.notificationCard,
                      !item.isRead && styles.notificationCardUnread,
                    ]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.iconAndTitle}>
                        <View style={styles.iconBubble}>
                          {getNotificationIcon(item.type)}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={styles.itemTime}>{item.time}</Text>
                        </View>
                      </View>

                      {!item.isRead && <View style={styles.unreadDot} />}
                    </View>

                    <Text style={styles.itemMessage}>{item.message}</Text>

                    {item.actionText && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => {
                            if (item.targetTab && onNavigateTab) {
                              onNavigateTab(item.targetTab);
                            }
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.actionBtnText}>{item.actionText}</Text>
                          <Feather name="arrow-right" size={13} color="#0284c7" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.lguFooterText}>
              Calatrava Tourism & LGU Emergency Updates Center
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markReadBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  markReadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#e0f2fe',
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 18,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: '#075985',
  },
  filterPillInactive: {
    backgroundColor: '#ffffff',
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  filterPillTextInactive: {
    color: '#64748b',
  },
  /* Content Panel */
  contentCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 520,
  },
  notificationList: {
    gap: 14,
  },
  notificationCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notificationCardUnread: {
    backgroundColor: '#ffffff',
    borderColor: '#bae6fd',
    shadowColor: '#0284c7',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284c7',
    marginLeft: 6,
    marginTop: 4,
  },
  itemMessage: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  lguFooterText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 24,
    marginBottom: 10,
  },
});