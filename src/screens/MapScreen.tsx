import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Image,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

// Calatrava Center Default Coordinates
const CALATRAVA_REGION = {
  latitude: 12.6186,
  longitude: 122.0722,
  latitudeDelta: 0.09,
  longitudeDelta: 0.09,
};

const MAP_FILTERS = [
  { id: 'all', label: 'All Places', icon: 'apps-outline' },
  { id: 'explore', label: 'Beaches & Coves', icon: 'water-outline' },
  { id: 'hotels', label: 'Hotels & Stays', icon: 'bed-outline' },
  { id: 'food', label: 'Food & Dining', icon: 'restaurant-outline' },
];

interface MapScreenProps {
  userLocation?: { latitude: number; longitude: number } | null;
  onGoBack?: () => void;
  onNavigateTab?: (tab: string) => void;
  onSelectDestination?: (item: any) => void;
}

export default function MapScreen({
  userLocation,
  onGoBack,
  onNavigateTab,
  onSelectDestination,
}: MapScreenProps) {
  const mapRef = useRef<MapView | null>(null);

  const [places, setPlaces] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMapPlaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.log('Map fetch error:', error.message);
        return;
      }

      if (data) {
        // Fallback default coordinates if not set in DB
        const mapped = data.map((item: any, idx: number) => ({
          ...item,
          latitude: item.latitude ? Number(item.latitude) : 12.6186 + (idx % 4) * 0.012 - 0.02,
          longitude: item.longitude ? Number(item.longitude) : 122.0722 + (idx % 3) * 0.012 - 0.015,
        }));
        setPlaces(mapped);
      }
    } catch (err) {
      console.log('Error loading map places:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapPlaces();
  }, []);

  // Recenter Map to Calatrava
  const handleResetView = () => {
    mapRef.current?.animateToRegion(CALATRAVA_REGION, 600);
    setSelectedPlace(null);
  };

  // Recenter Map to Current User Location
  const handleRecenterToUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        600
      );
    } else {
      handleResetView();
    }
  };

  // Filter places
  const filteredPlaces = places.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const brgyMatch = (p.barangay || '').toLowerCase().includes(q);
    if (q && !nameMatch && !brgyMatch) return false;

    const cat = (p.category || '').toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'hotels') {
      return (
        cat.includes('accommodation') ||
        cat.includes('hotel') ||
        cat.includes('stay') ||
        cat.includes('resort') ||
        cat.includes('inn')
      );
    }
    if (activeFilter === 'food') {
      return (
        cat.includes('food') ||
        cat.includes('dining') ||
        cat.includes('restaurant') ||
        cat.includes('cafe') ||
        cat.includes('grill')
      );
    }
    if (activeFilter === 'explore') {
      return !(
        cat.includes('accommodation') ||
        cat.includes('hotel') ||
        cat.includes('stay') ||
        cat.includes('food') ||
        cat.includes('dining') ||
        cat.includes('restaurant')
      );
    }
    return true;
  });

  const getMarkerColor = (category: string) => {
    const c = (category || '').toLowerCase();
    if (
      c.includes('accommodation') ||
      c.includes('hotel') ||
      c.includes('stay') ||
      c.includes('resort')
    ) {
      return '#0284c7'; // Blue for Hotels
    }
    if (
      c.includes('food') ||
      c.includes('dining') ||
      c.includes('restaurant') ||
      c.includes('cafe')
    ) {
      return '#ea580c'; // Orange for Food
    }
    return '#0284c7'; // Cyan/Blue for Sights
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Main Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={CALATRAVA_REGION}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {filteredPlaces.map((place) => {
          const isSelected = selectedPlace?.id === place.id;
          const markerColor = getMarkerColor(place.category);

          return (
            <Marker
              key={place.id}
              coordinate={{
                latitude: place.latitude,
                longitude: place.longitude,
              }}
              onPress={() => setSelectedPlace(place)}
            >
              <View
                style={[
                  styles.customMarker,
                  { backgroundColor: markerColor },
                  isSelected && styles.selectedMarker,
                ]}
              >
                <Ionicons
                  name={
                    markerColor === '#ea580c'
                      ? 'restaurant'
                      : markerColor === '#0284c7' && (place.category || '').toLowerCase().includes('hotel')
                      ? 'bed'
                      : 'location'
                  }
                  size={14}
                  color="#ffffff"
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top Floating Search and Filter Container */}
      <SafeAreaView edges={['top']} style={styles.topOverlayContainer}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search spots, hotels, dining, barangay..."
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

        {/* Filter Chips Horizontal List */}
        <FlatList
          horizontal
          data={MAP_FILTERS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.id;
            return (
              <TouchableOpacity
                onPress={() => setActiveFilter(item.id)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={isActive ? '#ffffff' : '#0284c7'}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>

      {/* Right-Side Floating Actions Column */}
      <View style={styles.floatingControls}>
        {/* 1. Category Switch Button */}
        <TouchableOpacity
          style={styles.fabBtn}
          activeOpacity={0.85}
          onPress={() => {
            const nextFilter =
              activeFilter === 'all'
                ? 'explore'
                : activeFilter === 'explore'
                ? 'hotels'
                : activeFilter === 'hotels'
                ? 'food'
                : 'all';
            setActiveFilter(nextFilter);
          }}
        >
          <Ionicons name="layers-outline" size={20} color="#0284c7" />
        </TouchableOpacity>

        {/* 2. Reset / Overview View Button */}
        <TouchableOpacity style={styles.fabBtn} activeOpacity={0.85} onPress={handleResetView}>
          <Ionicons name="refresh" size={20} color="#0284c7" />
        </TouchableOpacity>

        {/* 3. My Location GPS Button (Stacked directly in the yellow marked spot) */}
        <TouchableOpacity style={styles.fabBtn} activeOpacity={0.85} onPress={handleRecenterToUser}>
          <Ionicons name="locate" size={20} color="#0284c7" />
        </TouchableOpacity>
      </View>

      {/* Bottom Place Preview Card */}
      {selectedPlace && (
        <View style={styles.bottomCardContainer}>
          <TouchableOpacity
            style={styles.previewCard}
            activeOpacity={0.9}
            onPress={() => onSelectDestination?.(selectedPlace)}
          >
            <Image
              source={{
                uri:
                  selectedPlace.image_url ||
                  (selectedPlace.images && selectedPlace.images[0]) ||
                  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
              }}
              style={styles.previewImage}
            />

            <View style={styles.previewContent}>
              <View style={styles.previewTopRow}>
                <Text style={styles.previewBadge}>
                  {(selectedPlace.category || 'DESTINATION').toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedPlace(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedPlace.name}
              </Text>

              <Text style={styles.previewLocation} numberOfLines={1}>
                <Ionicons name="location-outline" size={11} color="#64748b" />{' '}
                {selectedPlace.barangay ? `Brgy. ${selectedPlace.barangay}, Calatrava` : 'Calatrava, Romblon'}
              </Text>

              <View style={styles.previewBottomRow}>
                <Text style={styles.previewPrice}>
                  {selectedPlace.eco_fee ? `₱${selectedPlace.eco_fee}` : 'Free Entry'}
                </Text>

                <View style={styles.viewBtn}>
                  <Text style={styles.viewBtnText}>View</Text>
                  <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  map: {
    width: width,
    height: height,
  },
  topOverlayContainer: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  filterList: {
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  filterChipActive: {
    backgroundColor: '#0284c7',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  // Floating Controls Column (Right Side)
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 135,
    gap: 10,
    alignItems: 'center',
    zIndex: 10,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  customMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  selectedMarker: {
    transform: [{ scale: 1.25 }],
    borderColor: '#f59e0b',
    borderWidth: 2.5,
  },
  bottomCardContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  previewImage: {
    width: 90,
    height: 90,
    borderRadius: 14,
  },
  previewContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.4,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  previewLocation: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  previewBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  previewPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  viewBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});