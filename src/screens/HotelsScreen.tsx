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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export interface HotelItem {
  id: string;
  name: string;
  barangay: string;
  category: string;
  eco_fee: number;
  travel_time?: string;
  image_url?: string;
  images?: string[];
  description?: string;
  lgu_status?: string;
  is_popular?: boolean;
}

const FILTER_CHIPS = ['All', 'Resorts', 'Homestays', 'Budget'];

interface HotelsScreenProps {
  onGoBack?: () => void;
  onNavigateTab?: (tab: string) => void;
  onNavigateToMap?: () => void;
  onSelectHotel?: (hotel: HotelItem) => void;
}

export default function HotelsScreen({
  onGoBack,
  onNavigateTab,
  onNavigateToMap,
  onSelectHotel,
}: HotelsScreenProps) {
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({});

  const fetchHotels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching accommodations:', error.message);
        return;
      }

      if (data) {
        const staysOnly = data
          .filter((d: any) => d.is_active !== false)
          .filter((d: any) => {
            const c = (d.category || '').toLowerCase();
            return (
              c.includes('accommodation') ||
              c.includes('hotel') ||
              c.includes('stay') ||
              c.includes('resort') ||
              c.includes('inn') ||
              c.includes('homestay') ||
              c.includes('lodge') ||
              c.includes('transient')
            );
          });

        setHotels(staysOnly);
      }
    } catch (err) {
      console.log('Supabase load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHotels();

    const channel = supabase
      .channel('realtime-hotels-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destinations' },
        () => fetchHotels()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredHotels = hotels.filter((hotel) => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (hotel.name || '').toLowerCase().includes(q);
    const brgyMatch = (hotel.barangay || '').toLowerCase().includes(q);
    const descMatch = (hotel.description || '').toLowerCase().includes(q);
    const matchesSearch = q === '' || nameMatch || brgyMatch || descMatch;

    if (!matchesSearch) return false;

    if (activeFilter === 'All') return true;
    if (activeFilter === 'Resorts') {
      return (
        (hotel.name || '').toLowerCase().includes('resort') ||
        (hotel.category || '').toLowerCase().includes('resort')
      );
    }
    if (activeFilter === 'Homestays') {
      return (
        (hotel.name || '').toLowerCase().includes('homestay') ||
        (hotel.category || '').toLowerCase().includes('homestay') ||
        (hotel.category || '').toLowerCase().includes('inn') ||
        (hotel.name || '').toLowerCase().includes('inn')
      );
    }
    if (activeFilter === 'Budget') {
      return hotel.eco_fee && Number(hotel.eco_fee) <= 1000;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" />

      {/* Top Gradient Banner Header */}
      <LinearGradient colors={['#0284c7', '#38bdf8']} style={styles.headerBanner}>
        <SafeAreaView edges={['top']}>
          {/* Back & Title Row */}
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backBtn} onPress={onGoBack} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#0284c7" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mapViewBtn}
              onPress={() => {
                if (onNavigateToMap) onNavigateToMap();
                else onNavigateTab?.('maps');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.mapViewText}>Map View</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Hotels & Stays</Text>
            <Text style={styles.headerSubtitle}>
              {hotels.length} {hotels.length === 1 ? 'place' : 'places'} registered in Calatrava
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search registered hotels, homestays..."
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

          {/* Filter Chips */}
          <FlatList
            horizontal
            data={FILTER_CHIPS}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const isActive = activeFilter === item;
              return (
                <TouchableOpacity
                  onPress={() => setActiveFilter(item)}
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

      {/* Main List Body */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Syncing accommodations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHotels}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.cardList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchHotels();
              }}
              tintColor="#0284c7"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bed-outline" size={54} color="#bae6fd" />
              <Text style={styles.emptyTitle}>No Hotels Registered Yet</Text>
              <Text style={styles.emptySub}>
                Add accommodations in the Admin Portal under "Hotels & Stays" to see them here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const displayImg =
              item.image_url ||
              (item.images && item.images.length > 0 ? item.images[0] : null);
            const isFav = !!favorites[item.id];

            return (
              <View style={styles.card}>
                {displayImg ? (
                  <Image source={{ uri: displayImg }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.placeholderImage]}>
                    <Ionicons name="business-outline" size={28} color="#94a3b8" />
                  </View>
                )}

                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.categoryBadge}>
                      {item.lgu_status || 'LGU REGISTERED'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isFav ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isFav ? '#e11d48' : '#94a3b8'}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.hotelName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <Text style={styles.locationText} numberOfLines={1}>
                    <Ionicons name="location-outline" size={11} color="#64748b" />{' '}
                    {item.barangay ? `${item.barangay}, Calatrava` : 'Calatrava, Romblon'}
                  </Text>

                  {item.travel_time ? (
                    <Text style={styles.amenitiesText} numberOfLines={1}>
                      {item.travel_time}
                    </Text>
                  ) : item.description ? (
                    <Text style={styles.amenitiesText} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.priceText}>
                      {item.eco_fee && Number(item.eco_fee) > 0 ? (
                        <>
                          ₱{Number(item.eco_fee).toLocaleString()}
                          <Text style={styles.pricePeriod}> / night</Text>
                        </>
                      ) : (
                        <Text style={styles.priceContact}>Rate on inquiry</Text>
                      )}
                    </Text>

                    <TouchableOpacity
                      style={styles.viewBtn}
                      activeOpacity={0.85}
                      onPress={() => onSelectHotel?.(item)}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
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
    paddingBottom: 20,
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
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  mapViewBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
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
    height: 48,
    borderRadius: 24,
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
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
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
  cardList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardImage: {
    width: 105,
    height: 115,
    borderRadius: 16,
  },
  placeholderImage: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hotelName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  amenitiesText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 3,
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284c7',
  },
  pricePeriod: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  priceContact: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  viewBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  viewBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 70,
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
});