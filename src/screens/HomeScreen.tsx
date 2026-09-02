import BottomNavBar from '../components/BottomNavBar';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform, // <-- Add this
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from '@expo/vector-icons';
import * as Location from 'expo-location';
import NewsTicker from '../components/NewsTicker';
import { supabase } from '../lib/supabase';

// Calatrava Municipal Center coordinates
const CALATRAVA_COORDS = {
  latitude: 12.6186,
  longitude: 122.0722,
};

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

interface DestinationItem {
  id: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  reviewsCount: number;
  entryFee: string;
  priceNote: string;
  image: string;
  isFavorite?: boolean;
}

interface HomeScreenProps {
  onNavigateTab?: (tab: string) => void;
  onSelectDestination?: (item: DestinationItem) => void;
  locationLabel?: string;
  distanceSubtext?: string;
  onLocationDetailsUpdated?: (
    label: string,
    subtext: string,
    coords: { latitude: number; longitude: number }
  ) => void;
  onLocationUpdated?: (coords: { latitude: number; longitude: number }) => void;
}

export default function HomeScreen({ 
  onNavigateTab, 
  onSelectDestination, 
  locationLabel = 'Calatrava, Romblon',
  distanceSubtext = 'Find your next adventure...',
  onLocationDetailsUpdated,
  onLocationUpdated 
}: HomeScreenProps) {
  const [destinations, setDestinations] = useState<DestinationItem[]>([]);
  const [liveAdvisory, setLiveAdvisory] = useState({
    condition: 'Calm / Safe for Boats',
    message: 'Normal sea operations permitted.',
  });
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [lastCoords, setLastCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const loadData = async () => {
    try {
      const { data: advisoryData, error: advisoryError } = await supabase
        .from('advisories')
        .select('sea_condition, advisory_message')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (advisoryError) console.log('Advisory query error:', advisoryError);

      if (advisoryData) {
        setLiveAdvisory({
          condition: advisoryData.sea_condition || 'Normal',
          message: advisoryData.advisory_message || 'No active warnings.',
        });
      }

      const { data: destData, error: destError } = await supabase
        .from('destinations')
        .select('*')
        .eq('is_popular', true)
        .order('created_at', { ascending: false });

      if (destError) console.log('Destinations query error:', destError);

      if (destData) {
        const mappedDestinations = destData.map((d: any) => ({
          id: String(d.id),
          name: d.name,
          category: d.category || 'Island & Lagoon',
          location: d.barangay || 'Calatrava',
          rating: d.rating || 4.8,
          reviewsCount: d.reviews_count || 0,
          entryFee: d.eco_fee ? `₱${d.eco_fee} Entry Fee` : 'Free Entry',
          priceNote: d.travel_time || '15 mins by boat',
          image: d.image_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
          images: d.images && d.images.length > 0 ? d.images : (d.image_url ? [d.image_url] : []),
          lgu_status: d.lgu_status || 'LGU Registered',
          description: d.description || '',
          visitor_advisory: d.visitor_advisory || '',
          is_popular: d.is_popular ?? true,
        }));
        setDestinations(mappedDestinations);
      }
    } catch (err) {
      console.log('Error loading data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateLocation = async () => {
    if (locating) return;
    setLocating(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please allow location access in your device settings.'
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      setLastCoords({ latitude: userLat, longitude: userLng });

      const distance = getDistanceKm(
        userLat,
        userLng,
        CALATRAVA_COORDS.latitude,
        CALATRAVA_COORDS.longitude
      );

      const geocoded = await Location.reverseGeocodeAsync({
        latitude: userLat,
        longitude: userLng,
      });

      let fullAddress = 'Calatrava, Romblon';
      let subtext = `📍 ~${distance} km away from Calatrava`;

      if (geocoded && geocoded.length > 0) {
        const place = geocoded[0];

        const municipality = (
          place.city ||
          (place.subregion &&
          !place.subregion.toLowerCase().includes('romblon') &&
          !place.subregion.toLowerCase().includes('mimaropa')
            ? place.subregion
            : null) ||
          place.district ||
          'Odiongan'
        ).trim();

        const rawRegion = place.region || place.subregion || 'Romblon';
        const province = rawRegion.toUpperCase().includes('MIMAROPA')
          ? 'Romblon'
          : rawRegion.trim();

        let localArea = (place.street || place.name || place.district || '').trim();
        localArea = localArea.replace(/^(brgy\.?|barangay)\s*/i, '').trim();

        const isDuplicateOrEmpty =
          !localArea ||
          localArea.toLowerCase() === municipality.toLowerCase() ||
          localArea.toLowerCase() === province.toLowerCase() ||
          localArea.toLowerCase().includes('philippines') ||
          localArea.toLowerCase().includes('unnamed road');

        if (isDuplicateOrEmpty) {
          fullAddress = `${municipality}, ${province}`;
        } else {
          fullAddress = `${localArea}, ${municipality}, ${province}`;
        }

        if (
          municipality.toLowerCase().includes('calatrava') ||
          fullAddress.toLowerCase().includes('calatrava')
        ) {
          subtext = '📍 You are inside Calatrava';
        } else {
          subtext = `📍 ~${distance} km away from Calatrava`;
        }
      }

      onLocationDetailsUpdated?.(fullAddress, subtext, {
        latitude: userLat,
        longitude: userLng,
      });
      onLocationUpdated?.({ latitude: userLat, longitude: userLng });
    } catch (err: any) {
      console.error('Location Error:', err);
      Alert.alert('GPS Error', 'Unable to retrieve location coordinates.');
    } finally {
      setLocating(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0ea5e9" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284c7']} />
        }
      >
        {/* Top Header Card */}
        <LinearGradient
          colors={['#0284c7', '#38bdf8']}
          style={styles.headerBanner}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1, marginRight: 10 }}>
              {/* Clickable Location Row */}
              <TouchableOpacity
                onPress={() => setShowLocationModal(true)}
                activeOpacity={0.8}
                style={styles.locationRow}
              >
                <Ionicons name="location-sharp" size={16} color="#ef4444" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationLabel}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#e0f2fe" style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              {/* Subtext and Quick Update */}
              <View style={styles.subtextRow}>
                <Text style={styles.headerSub}>{distanceSubtext}</Text>
                <TouchableOpacity
                  onPress={handleUpdateLocation}
                  disabled={locating}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.updateTouchArea}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginLeft: 6 }} />
                  ) : (
                    <Text style={styles.updateLocationText}>• Update</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.notifButton}
              onPress={() => onNavigateTab?.('notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search destinations, stays, guides..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
          </View>

          {/* Category Icons Row */}
          <Text style={styles.categoryTitle}>Categories</Text>
          <View style={styles.categoriesRow}>
            <TouchableOpacity
              style={styles.catItem}
              onPress={() => onNavigateTab?.('hotels')}
            >
              <View style={styles.catIconCircle}>
                <MaterialCommunityIcons name="office-building" size={24} color="#0284c7" />
              </View>
              <Text style={styles.catLabel}>Hotels</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.catItem}
              onPress={() => onNavigateTab?.('transportation')}
            >
              <View style={styles.catIconCircle}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#0284c7" />
              </View>
              <Text style={styles.catLabel}>Transportation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.catItem}
              onPress={() => onNavigateTab?.('explore')}
            >
              <View style={styles.catIconCircle}>
                <MaterialCommunityIcons name="map-outline" size={24} color="#0284c7" />
              </View>
              <Text style={styles.catLabel}>Explore</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.catItem}
              onPress={() => onNavigateTab?.('food')}
            >
              <View style={styles.catIconCircle}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={24} color="#0284c7" />
              </View>
              <Text style={styles.catLabel}>Food</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Live Sea Condition Ticker */}
        <NewsTicker
          condition={liveAdvisory.condition}
          message={liveAdvisory.message}
        />

        {/* Section: Popular Destination */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Popular Destination</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            onPress={() => onNavigateTab?.('all_destinations')}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Destination Cards */}
        <View style={styles.destinationsContainer}>
          {destinations.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => onSelectDestination && onSelectDestination(item)}
            >
              <View style={styles.imageContainer}>
                <Image source={{ uri: item.image }} style={styles.cardImage} />
                <TouchableOpacity style={styles.heartButton} activeOpacity={0.7}>
                  <Ionicons name="heart-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.category} • {item.location}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={15} color="#f59e0b" />
                    <Text style={styles.ratingText}>{item.rating} ({item.reviewsCount})</Text>
                    <Text style={styles.ecoFeeText}>• {item.entryFee}</Text>
                  </View>
                  <Text style={styles.travelTimeText}>{item.priceNote}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Location Details Modal */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBg}>
                <Ionicons name="location" size={24} color="#0284c7" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Your Location</Text>
                <Text style={styles.modalSubtitle}>GPS Geolocation Status</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLocationModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Address Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>RESOLVED ADDRESS</Text>
              <Text style={styles.infoValue}>{locationLabel}</Text>
            </View>

            {/* Status & Distance */}
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>TOURISM PROXIMITY</Text>
              <Text style={styles.infoValue}>{distanceSubtext}</Text>
              {lastCoords && (
                <Text style={styles.coordsText}>
                  Coordinates: {lastCoords.latitude.toFixed(4)}, {lastCoords.longitude.toFixed(4)}
                </Text>
              )}
            </View>

            {/* Travel Advisory / Tip */}
            <View style={styles.tipBox}>
              <Ionicons name="information-circle-outline" size={18} color="#0284c7" style={{ marginTop: 2 }} />
              <Text style={styles.tipText}>
                {locationLabel.toLowerCase().includes('calatrava')
                  ? 'You are currently inside Calatrava. Standard municipal fares and local boat tours apply.'
                  : 'Traveling to Calatrava? Tricycles, jeepneys, and van charters are readily available across Tablas Island.'}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.refreshModalBtn}
                onPress={async () => {
                  await handleUpdateLocation();
                }}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color="#0284c7" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color="#0284c7" />
                    <Text style={styles.refreshModalBtnText}>Update GPS</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowLocationModal(false)}
              >
                <Text style={styles.closeModalBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Animated Reusable Bottom Navigation */}
      <BottomNavBar
        activeTab="home"
        onNavigateTab={(tab) => onNavigateTab?.(tab)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  headerBanner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
    flexShrink: 1,
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  headerSub: {
    color: '#e0f2fe',
    fontSize: 12,
    fontWeight: '600',
  },
  updateTouchArea: {
    paddingVertical: 2,
    marginLeft: 4,
  },
  updateLocationText: {
    color: '#ffffff',
    fontSize: 12,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  categoryTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catItem: {
    alignItems: 'center',
  },
  catIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  catLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284c7',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  destinationsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 14,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  ecoFeeText: {
    fontSize: 12,
    color: '#64748b',
  },
  travelTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  coordsText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tipBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 18,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 17,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  refreshModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#ffffff',
  },
  refreshModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  closeModalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0284c7',
  },
  closeModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});