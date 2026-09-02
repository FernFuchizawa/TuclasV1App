import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface ManifestPerson {
  name: string;
  age: number | string;
  gender: string;
}

interface BookingRecord {
  id: string;
  trip_date: string;
  trip_time: string;
  booking_type: string;
  pax_count: number;
  contact_person: string;
  contact_phone: string;
  total_fare: number;
  lgu_eco_fee: number;
  status: 'pending' | 'accepted' | 'dispatched' | 'completed' | 'cancelled';
  passenger_manifest: ManifestPerson[];
  created_at: string;
  destinations?: {
    name: string;
    barangay: string;
    image_url?: string;
  };
  fleet_units?: {
    unit_name: string;
    assigned_person: string;
    contact_phone: string;
  };
  operators?: {
    name: string;
    contact_number: string;
  };
}

interface BookingsScreenProps {
  onNavigateTab?: (tab: string) => void;
}

export default function BookingsScreen({ onNavigateTab }: BookingsScreenProps) {
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Digital Boarding Pass Modal
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);

  const fetchUserBookings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setBookings([]);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          destinations ( name, barangay, image_url ),
          fleet_units ( unit_name, assigned_person, contact_phone ),
          operators ( name, contact_number )
        `)
        .eq('tourist_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Bookings fetch error:', error.message);
        return;
      }

      if (data) {
        setBookings(data);
      }
    } catch (err) {
      console.log('Error loading user bookings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserBookings();

    const channel = supabase
      .channel('tourist-bookings-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => fetchUserBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCallContact = (phone?: string) => {
    if (!phone) {
      Alert.alert('Notice', 'No direct contact phone number is assigned yet.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call on this device.');
    });
  };

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking Request',
      'Are you sure you want to cancel this booking request?',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

              if (error) throw error;
              fetchUserBookings();
              Alert.alert('Cancelled', 'Your booking request has been cancelled.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to cancel booking.');
            }
          },
        },
      ]
    );
  };

  const activeCount = bookings.filter(
    (b) => b.status === 'pending' || b.status === 'accepted' || b.status === 'dispatched'
  ).length;

  const filteredBookings = bookings.filter((b) => {
    if (selectedTab === 'upcoming') {
      return b.status === 'pending' || b.status === 'accepted' || b.status === 'dispatched';
    }
    if (selectedTab === 'completed') {
      return b.status === 'completed';
    }
    if (selectedTab === 'cancelled') {
      return b.status === 'cancelled';
    }
    return true;
  });

  const getStatusBadge = (status: BookingRecord['status']) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Awaiting Operator',
          bg: '#fef3c7',
          text: '#d97706',
          icon: 'hourglass-outline' as const,
        };
      case 'accepted':
        return {
          label: 'Vessel Assigned',
          bg: '#dcfce7',
          text: '#16a34a',
          icon: 'checkmark-circle-outline' as const,
        };
      case 'dispatched':
        return {
          label: 'En Route / Active',
          bg: '#e0f2fe',
          text: '#0284c7',
          icon: 'navigate-outline' as const,
        };
      case 'completed':
        return {
          label: 'Completed',
          bg: '#f1f5f9',
          text: '#64748b',
          icon: 'flag-outline' as const,
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bg: '#fee2e2',
          text: '#ef4444',
          icon: 'close-circle-outline' as const,
        };
    }
  };

  return (
    <LinearGradient
      colors={['#0284c7', '#0ea5e9', '#38bdf8', '#e0f2fe']}
      locations={[0, 0.22, 0.55, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" translucent />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchUserBookings();
              }}
              tintColor="#ffffff"
            />
          }
        >
          {/* Header Row with Constrained Flex Layout */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.screenTitle}>My Bookings</Text>
              <Text style={styles.screenSub} numberOfLines={2}>
                Manage your island passes & Coast Guard manifests
              </Text>
            </View>

            <TouchableOpacity
              style={styles.newBookingHeaderBtn}
              onPress={() => onNavigateTab?.('explore')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#0284c7" />
              <Text style={styles.newBookingHeaderText}>Book Tour</Text>
            </TouchableOpacity>
          </View>

          {/* Responsive Segmented Filter Tabs */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedTab === 'upcoming'
                  ? styles.filterPillActivePrimary
                  : styles.filterPillInactive,
              ]}
              onPress={() => setSelectedTab('upcoming')}
              activeOpacity={0.8}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.filterPillText,
                  selectedTab === 'upcoming'
                    ? styles.filterPillTextActive
                    : styles.filterPillTextInactive,
                ]}
              >
                Active ({activeCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedTab === 'completed'
                  ? styles.filterPillActivePrimary
                  : styles.filterPillInactive,
              ]}
              onPress={() => setSelectedTab('completed')}
              activeOpacity={0.8}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.filterPillText,
                  selectedTab === 'completed'
                    ? styles.filterPillTextActive
                    : styles.filterPillTextInactive,
                ]}
              >
                Completed
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedTab === 'cancelled'
                  ? styles.filterPillActivePrimary
                  : styles.filterPillInactive,
              ]}
              onPress={() => setSelectedTab('cancelled')}
              activeOpacity={0.8}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.filterPillText,
                  selectedTab === 'cancelled'
                    ? styles.filterPillTextActive
                    : styles.filterPillTextInactive,
                ]}
              >
                Cancelled
              </Text>
            </TouchableOpacity>
          </View>

          {/* Offline Security Advisory Banner */}
          <View style={styles.offlineCard}>
            <Ionicons name="cloud-offline-outline" size={16} color="#0369a1" />
            <Text style={styles.offlineNotice}>
              Digital passes remain saved on your device for offline port verification.
            </Text>
          </View>

          {/* Main Bookings Feed */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.loadingText}>Syncing trip permits...</Text>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {filteredBookings.map((booking) => {
                const badge = getStatusBadge(booking.status);
                const grandTotal =
                  Number(booking.total_fare || 0) + Number(booking.lgu_eco_fee || 0);

                return (
                  <View key={booking.id} style={styles.card}>
                    {/* Top Row */}
                    <View style={styles.cardHeader}>
                      <View style={styles.typeBadge}>
                        <MaterialCommunityIcons
                          name={booking.booking_type === 'boat_tour' ? 'sail-boat' : 'car'}
                          size={13}
                          color="#0284c7"
                        />
                        <Text style={styles.bookingType}>
                          {booking.booking_type === 'boat_tour'
                            ? 'ISLAND HOPPING'
                            : 'LAND CHARTER'}
                        </Text>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                        <Ionicons name={badge.icon} size={12} color={badge.text} />
                        <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Destination Title */}
                    <Text style={styles.bookingTitle}>
                      {booking.destinations?.name || 'Calatrava Island Tour Package'}
                    </Text>

                    {/* Schedule & Pax */}
                    <View style={styles.metaInfoRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={13} color="#0284c7" />
                        <Text style={styles.metaItemText}>
                          {booking.trip_date} • {booking.trip_time}
                        </Text>
                      </View>

                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={13} color="#0284c7" />
                        <Text style={styles.metaItemText}>{booking.pax_count} Passengers</Text>
                      </View>
                    </View>

                    {/* Assigned Vessel Information Box */}
                    {booking.fleet_units?.unit_name ? (
                      <View style={styles.assignedVesselCard}>
                        <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.vesselTitle}>
                            Assigned: {booking.fleet_units.unit_name}
                          </Text>
                          <Text style={styles.captainText}>
                            Captain: {booking.fleet_units.assigned_person} (
                            {booking.fleet_units.contact_phone})
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.pendingVesselCard}>
                        <Ionicons name="time-outline" size={15} color="#d97706" />
                        <Text style={styles.pendingVesselText}>
                          Operator is assigning an accredited vessel & captain.
                        </Text>
                      </View>
                    )}

                    {/* Fare Summary */}
                    <View style={styles.fareSummaryRow}>
                      <View>
                        <Text style={styles.fareSummaryLabel}>Total Charter + Eco-Fee</Text>
                        <Text style={styles.fareSummaryValue}>₱{grandTotal.toLocaleString()}</Text>
                      </View>

                      <Text style={styles.payLocationText}>Pay at Wharf Dispatch</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.actionBtnDark}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedBooking(booking);
                          setShowPassModal(true);
                        }}
                      >
                        <Ionicons name="qr-code-outline" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.actionBtnTextDark}>Boarding Pass</Text>
                      </TouchableOpacity>

                      {booking.fleet_units?.contact_phone ? (
                        <TouchableOpacity
                          style={styles.actionBtnBlue}
                          activeOpacity={0.85}
                          onPress={() => handleCallContact(booking.fleet_units?.contact_phone)}
                        >
                          <Ionicons name="call" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnTextBlue}>Call Captain</Text>
                        </TouchableOpacity>
                      ) : booking.status === 'pending' ? (
                        <TouchableOpacity
                          style={styles.actionBtnCancel}
                          activeOpacity={0.85}
                          onPress={() => handleCancelBooking(booking.id)}
                        >
                          <Text style={styles.actionBtnTextCancel}>Cancel</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}

              {filteredBookings.length === 0 && (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="ticket-confirmation-outline" size={54} color="#ffffff" />
                  <Text style={styles.emptyTitle}>No {selectedTab} bookings</Text>
                  <Text style={styles.emptySub}>
                    Reserve an island hopping tour or beach charter to get your official Coast Guard boarding pass.
                  </Text>
                  <TouchableOpacity
                    style={styles.exploreBtn}
                    onPress={() => onNavigateTab?.('explore')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="compass-outline" size={16} color="#0284c7" style={{ marginRight: 4 }} />
                    <Text style={styles.exploreBtnText}>Browse Tours & Spots</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Digital Boarding Pass Modal */}
      <Modal
        visible={showPassModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPassModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passCard}>
            {selectedBooking && (
              <>
                <View style={styles.passHeader}>
                  <View>
                    <Text style={styles.passBadge}>MUNICIPALITY OF CALATRAVA</Text>
                    <Text style={styles.passTitle}>Official Maritime Boarding Pass</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowPassModal(false)}
                    style={styles.closePassBtn}
                  >
                    <Ionicons name="close" size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  <View style={styles.ticketBox}>
                    <Text style={styles.ticketDestName}>
                      {selectedBooking.destinations?.name || 'Calatrava Tour Pass'}
                    </Text>
                    <Text style={styles.ticketBookingRef}>
                      PASS REF: CAL-{selectedBooking.id.slice(0, 8).toUpperCase()}
                    </Text>

                    {/* QR Code */}
                    <View style={styles.qrContainer}>
                      <Ionicons name="qr-code" size={110} color="#0f172a" />
                      <Text style={styles.qrScanText}>
                        Present to Coast Guard & MDRRMO Wharf Inspector
                      </Text>
                    </View>

                    <View style={styles.ticketDivider} />

                    <View style={styles.ticketDetailRow}>
                      <View>
                        <Text style={styles.ticketLabel}>Departure Schedule</Text>
                        <Text style={styles.ticketValue}>
                          {selectedBooking.trip_date} • {selectedBooking.trip_time}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.ticketLabel}>Vessel Unit</Text>
                        <Text style={styles.ticketValue}>
                          {selectedBooking.fleet_units?.unit_name || 'Vessel Pending'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.ticketDetailRow, { marginTop: 8 }]}>
                      <View>
                        <Text style={styles.ticketLabel}>Assigned Captain</Text>
                        <Text style={styles.ticketValue}>
                          {selectedBooking.fleet_units?.assigned_person || 'Dispatcher Queue'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.ticketLabel}>Total Group</Text>
                        <Text style={styles.ticketValue}>
                          {selectedBooking.pax_count} Pax
                        </Text>
                      </View>
                    </View>

                    {/* Manifest Table */}
                    <Text style={styles.manifestSectionTitle}>
                      REGISTERED PASSENGER MANIFEST
                    </Text>

                    {selectedBooking.passenger_manifest &&
                    selectedBooking.passenger_manifest.length > 0 ? (
                      selectedBooking.passenger_manifest.map((pax, index) => (
                        <View key={index} style={styles.manifestTableRow}>
                          <Text style={styles.manifestTableIndex}>#{index + 1}</Text>
                          <Text style={styles.manifestTableName}>{pax.name}</Text>
                          <Text style={styles.manifestTableMeta}>
                            Age {pax.age || 'N/A'} • {pax.gender || 'M'}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyManifestText}>
                        Lead Passenger: {selectedBooking.contact_person}
                      </Text>
                    )}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={styles.closePassFullBtn}
                  onPress={() => setShowPassModal(false)}
                >
                  <Text style={styles.closePassFullBtnText}>Close Pass</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  screenSub: {
    fontSize: 12,
    color: '#e0f2fe',
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 16,
  },
  newBookingHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    flexShrink: 0,
  },
  newBookingHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
    marginLeft: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterPillActivePrimary: {
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  filterPillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#0284c7',
    fontWeight: '800',
  },
  filterPillTextInactive: {
    color: '#ffffff',
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  offlineNotice: {
    fontSize: 11,
    color: '#0369a1',
    fontWeight: '600',
    flex: 1,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bookingType: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  metaInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  assignedVesselCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 10,
  },
  vesselTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16a34a',
  },
  captainText: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 1,
  },
  pendingVesselCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 10,
  },
  pendingVesselText: {
    fontSize: 11,
    color: '#b45309',
    flex: 1,
    fontWeight: '500',
  },
  fareSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 12,
  },
  fareSummaryLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  fareSummaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  payLocationText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnDark: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    height: 40,
    borderRadius: 10,
  },
  actionBtnTextDark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnBlue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    height: 40,
    borderRadius: 10,
  },
  actionBtnTextBlue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    height: 40,
    borderRadius: 10,
  },
  actionBtnTextCancel: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#e0f2fe',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 260,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
    elevation: 3,
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  passCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  passBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  passTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  closePassBtn: {
    padding: 4,
  },
  ticketBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  ticketDestName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  ticketBookingRef: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    marginTop: 2,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrScanText: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 220,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  ticketDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ticketLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  ticketValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  manifestSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  manifestTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  manifestTableIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    width: 22,
  },
  manifestTableName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  manifestTableMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  emptyManifestText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  closePassFullBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closePassFullBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});