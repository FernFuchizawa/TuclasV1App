import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export interface ExploreActivityItem {
  id: string;
  name: string;
  barangay: string;
  category: string;
  eco_fee: number | string;
  travel_time?: string;
  image_url?: string;
  images?: string[];
  description?: string;
  lgu_status?: string;
  rating?: number;
  reviews_count?: number;
}

interface ManifestPerson {
  name: string;
  age: string | number;
  gender: 'M' | 'F';
}

const FILTER_TAGS = [
  'All',
  'Islands & Beaches',
  'Tours & Charters',
  'Caves & Treks',
  'Snorkeling & Marine',
  'Viewpoints',
];

const BARANGAY_ZONES = [
  'All Areas',
  'Talisay',
  'Poblacion',
  'San Roque',
  'Linao',
  'Pangulo',
  'Balogo',
];

const DEPARTURE_TIMES = ['07:00 AM', '08:30 AM', '10:00 AM', '01:00 PM'];

interface ExploreScreenProps {
  onGoBack?: () => void;
  onNavigateTab?: (tab: string) => void;
  onSelectDestination?: (item: ExploreActivityItem) => void;
}

export default function ExploreScreen({
  onGoBack,
  onNavigateTab,
  onSelectDestination,
}: ExploreScreenProps) {
  const [items, setItems] = useState<ExploreActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedZone, setSelectedZone] = useState('All Areas');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({});

  // Booking Modal States
  const [bookingItem, setBookingItem] = useState<ExploreActivityItem | null>(null);
  const [tripDate, setTripDate] = useState('');
  const [tripTime, setTripTime] = useState('08:30 AM');
  const [paxCount, setPaxCount] = useState(2);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [passengers, setPassengers] = useState<ManifestPerson[]>([
    { name: '', age: '', gender: 'M' },
    { name: '', age: '', gender: 'F' },
  ]);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const fetchExploreAndActivities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching explore & activities:', error.message);
        return;
      }

      if (data) {
        const sightsAndActivities = data
          .filter((d: any) => d.is_active !== false)
          .filter((d: any) => {
            const cat = (d.category || '').toLowerCase();
            const isStay =
              cat.includes('accommodation') ||
              cat.includes('hotel') ||
              cat.includes('stay') ||
              cat.includes('resort') ||
              cat.includes('homestay') ||
              cat.includes('inn') ||
              cat.includes('lodge');
            const isFood =
              cat.includes('food') ||
              cat.includes('dining') ||
              cat.includes('restaurant') ||
              cat.includes('cafe') ||
              cat.includes('eatery');

            return !isStay && !isFood;
          });

        setItems(sightsAndActivities);
      }
    } catch (err) {
      console.log('Supabase explore error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExploreAndActivities();

    const channel = supabase
      .channel('realtime-explore-activities-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destinations' },
        () => fetchExploreAndActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Initialize booking details when opening modal
  const openBookingModal = async (item: ExploreActivityItem) => {
    setBookingItem(item);

    // Default to tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    setTripDate(dateString);

    // Fetch user details for autofill
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const meta = user.user_metadata || {};
      const fullName = meta.full_name || '';
      const phone = meta.phone_number || user.phone || '';
      setContactName(fullName);
      setContactPhone(phone);
      setPassengers([
        { name: fullName, age: '', gender: 'M' },
        { name: '', age: '', gender: 'F' },
      ]);
    } else {
      setPassengers([
        { name: '', age: '', gender: 'M' },
        { name: '', age: '', gender: 'F' },
      ]);
    }

    setPaxCount(2);
    setTripTime('08:30 AM');
  };

  // Adjust Pax Count and dynamic manifest fields
  const handlePaxChange = (delta: number) => {
    const newCount = Math.max(1, Math.min(15, paxCount + delta));
    setPaxCount(newCount);

    setPassengers((prev) => {
      const updated = [...prev];
      if (newCount > prev.length) {
        for (let i = prev.length; i < newCount; i++) {
          updated.push({ name: '', age: '', gender: 'M' });
        }
      } else {
        updated.splice(newCount);
      }
      return updated;
    });
  };

  // Calculate dynamic Boat Charter Fare tier
  const calculateBoatFare = (count: number) => {
    if (count <= 4) return 1500; // Small Boat Tier (1-4 pax)
    if (count <= 8) return 2500; // Medium Boat Tier (5-8 pax)
    return 3800; // Large Boat Tier (9-15 pax)
  };

  // Calculate Municipal Eco-Fee
  const perHeadEcoFee = Number(bookingItem?.eco_fee) || 50;
  const totalEcoFee = paxCount * perHeadEcoFee;
  const baseCharterFare = calculateBoatFare(paxCount);
  const grandTotal = baseCharterFare + totalEcoFee;

  const handleSubmitBooking = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter your primary contact name and mobile number.');
      return;
    }

    if (!tripDate.trim()) {
      Alert.alert('Required Fields', 'Please specify a trip date (YYYY-MM-DD).');
      return;
    }

    // Validate Manifest
    const cleanManifest = passengers.map((p, idx) => ({
      name: p.name.trim() || (idx === 0 ? contactName.trim() : `Passenger ${idx + 1}`),
      age: parseInt(String(p.age), 10) || 25,
      gender: p.gender || 'M',
    }));

    setSubmittingBooking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('bookings').insert([
        {
          tourist_id: user?.id || null,
          destination_id: bookingItem?.id || null,
          booking_type: 'boat_tour',
          trip_date: tripDate,
          trip_time: tripTime,
          pax_count: paxCount,
          contact_person: contactName.trim(),
          contact_phone: contactPhone.trim(),
          passenger_manifest: cleanManifest,
          total_fare: baseCharterFare,
          lgu_eco_fee: totalEcoFee,
          status: 'pending',
        },
      ]);

      if (error) throw error;

      setBookingItem(null);
      Alert.alert(
        'Booking Submitted!',
        'Your tour reservation and Coast Guard manifest have been sent to the Calatrava Boat Operators desk. You can monitor your booking confirmation in the Bookings tab.',
        [
          {
            text: 'View My Bookings',
            onPress: () => onNavigateTab?.('bookings'),
          },
          { text: 'Done', style: 'cancel' },
        ]
      );
    } catch (err: any) {
      Alert.alert('Booking Error', err.message || 'Unable to submit booking request.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (item.name || '').toLowerCase().includes(q);
    const brgyMatch = (item.barangay || '').toLowerCase().includes(q);
    const descMatch = (item.description || '').toLowerCase().includes(q);
    const matchesSearch = q === '' || nameMatch || brgyMatch || descMatch;

    if (!matchesSearch) return false;

    if (selectedZone !== 'All Areas') {
      if (!(item.barangay || '').toLowerCase().includes(selectedZone.toLowerCase())) {
        return false;
      }
    }

    if (selectedFilter === 'All') return true;
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    if (selectedFilter === 'Islands & Beaches') {
      return cat.includes('beach') || cat.includes('island') || cat.includes('cove') || name.includes('island');
    }
    if (selectedFilter === 'Tours & Charters') {
      return cat.includes('tour') || cat.includes('boat') || cat.includes('charter') || name.includes('hopping');
    }
    if (selectedFilter === 'Caves & Treks') {
      return cat.includes('cave') || cat.includes('trek') || cat.includes('rock');
    }
    if (selectedFilter === 'Snorkeling & Marine') {
      return cat.includes('marine') || cat.includes('snorkel') || cat.includes('sanctuary');
    }
    if (selectedFilter === 'Viewpoints') {
      return cat.includes('view') || cat.includes('hill') || cat.includes('mountain');
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" />

      {/* Top Banner */}
      <LinearGradient colors={['#0284c7', '#38bdf8']} style={styles.headerBanner}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backBtn} onPress={onGoBack} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#0284c7" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mapViewBtn}
              onPress={() => onNavigateTab?.('maps')}
              activeOpacity={0.85}
            >
              <Ionicons name="map-outline" size={14} color="#0284c7" style={{ marginRight: 4 }} />
              <Text style={styles.mapViewText}>Map View</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Explore & Activities</Text>
            <Text style={styles.headerSubtitle}>
              {items.length} scenic destinations, adventures, and tours in Calatrava
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search islands, tours, caving, snorkeling..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Chips */}
          <FlatList
            horizontal
            data={FILTER_TAGS}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const isActive = selectedFilter === item;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedFilter(item)}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </LinearGradient>

      {/* Barangay Zone Pills */}
      <View style={styles.zoneBar}>
        <Text style={styles.zoneLabel}>ZONE:</Text>
        <FlatList
          horizontal
          data={BARANGAY_ZONES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.zoneList}
          renderItem={({ item }) => {
            const isSelected = selectedZone === item;
            return (
              <TouchableOpacity
                onPress={() => setSelectedZone(item)}
                style={[styles.zonePill, isSelected && styles.zonePillSelected]}
                activeOpacity={0.8}
              >
                <Text style={[styles.zonePillText, isSelected && styles.zonePillTextSelected]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Unified Feed */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading destinations and tours...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.cardList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchExploreAndActivities();
              }}
              tintColor="#0284c7"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="compass-outline" size={54} color="#bae6fd" />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search terms or selecting another zone.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const displayImg =
              item.image_url ||
              (item.images && item.images.length > 0 ? item.images[0] : null) ||
              'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80';
            const isFav = !!favorites[item.id];

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.92}
                onPress={() => onSelectDestination?.(item)}
              >
                <View style={styles.imageContainer}>
                  <Image source={{ uri: displayImg }} style={styles.cardImage} />

                  <TouchableOpacity
                    style={styles.heartButton}
                    onPress={() => toggleFavorite(item.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isFav ? 'heart' : 'heart-outline'}
                      size={18}
                      color={isFav ? '#e11d48' : '#0f172a'}
                    />
                  </TouchableOpacity>

                  <View style={styles.categoryBadgeOverlay}>
                    <Text style={styles.categoryBadgeText}>
                      {(item.category || 'ATTRACTION').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.ratingBox}>
                      <Ionicons name="star" size={13} color="#f59e0b" />
                      <Text style={styles.ratingText}>
                        {item.rating || 4.8} ({item.reviews_count || 0})
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.locationText} numberOfLines={1}>
                    <Ionicons name="location-outline" size={12} color="#0284c7" />{' '}
                    {item.barangay ? `Brgy. ${item.barangay}, Calatrava` : 'Calatrava, Romblon'}
                  </Text>

                  {item.description ? (
                    <Text style={styles.descText} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <View style={styles.travelTimeRow}>
                      <Ionicons name="boat-outline" size={14} color="#64748b" />
                      <Text style={styles.travelTimeText}>
                        {item.travel_time || '15 mins access'}
                      </Text>
                    </View>

                    {/* Action Group: View Details & Quick Book */}
                    <View style={styles.cardActionGroup}>
                      <TouchableOpacity
                        style={styles.bookNowBtn}
                        activeOpacity={0.85}
                        onPress={() => openBookingModal(item)}
                      >
                        <MaterialCommunityIcons name="sail-boat" size={13} color="#ffffff" />
                        <Text style={styles.bookNowBtnText}>Book Tour</Text>
                      </TouchableOpacity>

                      <View style={styles.actionPill}>
                        <Text style={styles.actionPillText}>
                          {item.eco_fee ? `₱${item.eco_fee}` : 'Free'}
                        </Text>
                        <Ionicons name="arrow-forward" size={11} color="#0284c7" />
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Tour & Boat Charter Booking Modal */}
      <Modal
        visible={!!bookingItem}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingItem(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {bookingItem && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalBadge}>TOUR & BOAT CHARTER BOOKING</Text>
                    <Text style={styles.modalTitle}>{bookingItem.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setBookingItem(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  {/* Date and Time Selection */}
                  <View style={styles.sectionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>TRIP DATE (YYYY-MM-DD)</Text>
                      <TextInput
                        value={tripDate}
                        onChangeText={setTripDate}
                        placeholder="2026-09-15"
                        placeholderTextColor="#94a3b8"
                        style={styles.modalInput}
                      />
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>DEPARTURE TIME</Text>
                  <View style={styles.timeSelectorRow}>
                    {DEPARTURE_TIMES.map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeChip,
                          tripTime === time && styles.timeChipActive,
                        ]}
                        onPress={() => setTripTime(time)}
                      >
                        <Text
                          style={[
                            styles.timeChipText,
                            tripTime === time && styles.timeChipTextActive,
                          ]}
                        >
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Pax Counter */}
                  <View style={styles.paxSelectorCard}>
                    <View>
                      <Text style={styles.paxLabel}>Group Size / Passengers</Text>
                      <Text style={styles.paxSub}>
                        {paxCount <= 4
                          ? 'Small Pumpboat (1–4 Pax)'
                          : paxCount <= 8
                          ? 'Medium Vessel (5–8 Pax)'
                          : 'Large Tour Boat (9–15 Pax)'}
                      </Text>
                    </View>

                    <View style={styles.counterRow}>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => handlePaxChange(-1)}
                      >
                        <Ionicons name="remove" size={16} color="#0284c7" />
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{paxCount}</Text>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => handlePaxChange(1)}
                      >
                        <Ionicons name="add" size={16} color="#0284c7" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Lead Contact Info */}
                  <Text style={styles.inputLabel}>LEAD PASSENGER / CONTACT PERSON</Text>
                  <TextInput
                    value={contactName}
                    onChangeText={setContactName}
                    placeholder="Full Name"
                    placeholderTextColor="#94a3b8"
                    style={styles.modalInput}
                  />

                  <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                  <TextInput
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    placeholder="+63 912 345 6789"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    style={styles.modalInput}
                  />

                  {/* Coast Guard Manifest Section */}
                  <View style={styles.manifestHeaderBox}>
                    <Ionicons name="shield-checkmark" size={14} color="#0284c7" />
                    <Text style={styles.manifestHeaderTitle}>
                      Philippine Coast Guard & MDRRMO Passenger Manifest
                    </Text>
                  </View>

                  {passengers.map((pax, index) => (
                    <View key={index} style={styles.manifestRow}>
                      <Text style={styles.manifestIndexText}>#{index + 1}</Text>
                      <TextInput
                        value={pax.name}
                        onChangeText={(t) => {
                          const updated = [...passengers];
                          updated[index].name = t;
                          setPassengers(updated);
                        }}
                        placeholder={`Guest ${index + 1} Name`}
                        placeholderTextColor="#94a3b8"
                        style={[styles.modalInput, { flex: 2, marginBottom: 0 }]}
                      />
                      <TextInput
                        value={String(pax.age)}
                        onChangeText={(t) => {
                          const updated = [...passengers];
                          updated[index].age = t;
                          setPassengers(updated);
                        }}
                        placeholder="Age"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        style={[styles.modalInput, { width: 55, marginBottom: 0 }]}
                      />
                      <TouchableOpacity
                        style={styles.genderToggle}
                        onPress={() => {
                          const updated = [...passengers];
                          updated[index].gender = updated[index].gender === 'M' ? 'F' : 'M';
                          setPassengers(updated);
                        }}
                      >
                        <Text style={styles.genderToggleText}>{pax.gender}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Fare Summary Breakdown */}
                  <View style={styles.fareBreakdownCard}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Boat Charter Base Rate ({paxCount} Pax):</Text>
                      <Text style={styles.breakdownValue}>₱{baseCharterFare.toLocaleString()}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>LGU Tourism Eco-Fee (₱{perHeadEcoFee} × {paxCount}):</Text>
                      <Text style={styles.breakdownValue}>₱{totalEcoFee.toLocaleString()}</Text>
                    </View>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownRow}>
                      <Text style={styles.totalLabel}>Total Payable Amount:</Text>
                      <Text style={styles.totalValue}>₱{grandTotal.toLocaleString()}</Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      style={styles.cancelModalBtn}
                      onPress={() => setBookingItem(null)}
                    >
                      <Text style={styles.cancelModalBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.submitBookingBtn}
                      onPress={handleSubmitBooking}
                      disabled={submittingBooking}
                    >
                      {submittingBooking ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.submitBookingBtnText}>Confirm & Book</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  headerBanner: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  mapViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
  },
  mapViewText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitleContainer: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#e0f2fe',
    marginTop: 2,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  filterList: {
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  filterChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  filterChipTextActive: {
    color: '#0284c7',
  },
  zoneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  zoneLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    marginRight: 8,
    letterSpacing: 0.5,
  },
  zoneList: {
    gap: 6,
  },
  zonePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  zonePillSelected: {
    backgroundColor: '#0284c7',
  },
  zonePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  zonePillTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cardList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 160,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  locationText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  descText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  travelTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  travelTimeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  cardActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  bookNowBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 260,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 6,
  },
  timeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: '#0284c7',
  },
  timeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  timeChipTextActive: {
    color: '#ffffff',
  },
  paxSelectorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  paxLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  paxSub: {
    fontSize: 10.5,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  counterValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  manifestHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  manifestHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  manifestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  manifestIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    width: 22,
  },
  genderToggle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
  fareBreakdownCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  breakdownValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284c7',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  submitBookingBtn: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBookingBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});