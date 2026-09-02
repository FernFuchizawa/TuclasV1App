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

export interface FoodItem {
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
  contact_number?: string;
  visitor_advisory?: string;
}

const FOOD_FILTERS = [
  'All',
  'Seafood & Grills',
  'Local Carinderia',
  'Cafes & Desserts',
  'Pasalubong',
];

interface FoodScreenProps {
  onGoBack?: () => void;
  onNavigateTab?: (tab: string) => void;
  onSelectFood?: (item: FoodItem) => void;
}

export default function FoodScreen({
  onGoBack,
  onNavigateTab,
  onSelectFood,
}: FoodScreenProps) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({});

  const fetchFoodSpots = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching dining spots:', error.message);
        return;
      }

      if (data) {
        const diningOnly = data
          .filter((d: any) => d.is_active !== false)
          .filter((d: any) => {
            const cat = (d.category || '').toLowerCase();
            const name = (d.name || '').toLowerCase();
            return (
              cat.includes('food') ||
              cat.includes('dining') ||
              cat.includes('restaurant') ||
              cat.includes('cafe') ||
              cat.includes('grill') ||
              cat.includes('eatery') ||
              cat.includes('pasalubong') ||
              name.includes('restaurant') ||
              name.includes('cafe') ||
              name.includes('grill') ||
              name.includes('kitchen') ||
              name.includes('eatery')
            );
          });

        setFoods(diningOnly);
      }
    } catch (err) {
      console.log('Food fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFoodSpots();

    const channel = supabase
      .channel('realtime-food-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destinations' },
        () => fetchFoodSpots()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFoods = foods.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (item.name || '').toLowerCase().includes(q);
    const brgyMatch = (item.barangay || '').toLowerCase().includes(q);
    const descMatch = (item.description || '').toLowerCase().includes(q);
    const matchesSearch = q === '' || nameMatch || brgyMatch || descMatch;

    if (!matchesSearch) return false;

    if (activeFilter === 'All') return true;
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    if (activeFilter === 'Seafood & Grills') {
      return (
        cat.includes('seafood') ||
        cat.includes('grill') ||
        name.includes('seafood') ||
        name.includes('grill')
      );
    }
    if (activeFilter === 'Local Carinderia') {
      return (
        cat.includes('eatery') ||
        cat.includes('carinderia') ||
        name.includes('eatery') ||
        name.includes('lutong')
      );
    }
    if (activeFilter === 'Cafes & Desserts') {
      return (
        cat.includes('cafe') ||
        cat.includes('coffee') ||
        name.includes('cafe') ||
        name.includes('coffee')
      );
    }
    if (activeFilter === 'Pasalubong') {
      return (
        cat.includes('pasalubong') ||
        cat.includes('delicacy') ||
        name.includes('pasalubong')
      );
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" />

      {/* Top Banner Header */}
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
            <Text style={styles.headerTitle}>Food & Dining</Text>
            <Text style={styles.headerSubtitle}>
              {foods.length} verified dining spots, cafes, and local grills in Calatrava
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search local delicacies, restaurants, cafes..."
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
            data={FOOD_FILTERS}
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

      {/* Main Dining List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Syncing dining spots...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFoods}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.cardList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchFoodSpots();
              }}
              tintColor="#0284c7"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={54} color="#bae6fd" />
              <Text style={styles.emptyTitle}>No Dining Spots Found</Text>
              <Text style={styles.emptySub}>
                Add restaurants and eateries in the Admin Portal under the Food & Dining category.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const displayImg =
              item.image_url ||
              (item.images && item.images.length > 0 ? item.images[0] : null) ||
              'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80';
            const isFav = !!favorites[item.id];

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => onSelectFood?.(item)}
              >
                <Image source={{ uri: displayImg }} style={styles.cardImage} />

                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.categoryBadge}>
                      {item.lgu_status || 'LOCAL DINING'}
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

                  <Text style={styles.foodName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <Text style={styles.locationText} numberOfLines={1}>
                    <Ionicons name="location-outline" size={11} color="#64748b" />{' '}
                    {item.barangay ? `Brgy. ${item.barangay}, Calatrava` : 'Calatrava, Romblon'}
                  </Text>

                  {item.travel_time ? (
                    <Text style={styles.hoursText} numberOfLines={1}>
                      <Ionicons name="time-outline" size={11} color="#0284c7" /> {item.travel_time}
                    </Text>
                  ) : item.description ? (
                    <Text style={styles.descText} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.cardBottomRow}>
                    <View>
                      <Text style={styles.priceText}>
                        {item.eco_fee && Number(item.eco_fee) > 0 ? (
                          <>
                            ₱{Number(item.eco_fee).toLocaleString()}
                            <Text style={styles.pricePeriod}> / avg meal</Text>
                          </>
                        ) : (
                          <Text style={styles.pricePeriod}>Budget friendly</Text>
                        )}
                      </Text>
                      <View style={styles.ratingInline}>
                        <Ionicons name="star" size={11} color="#f59e0b" />
                        <Text style={styles.ratingInlineText}>
                          {item.rating || 5.0} ({item.reviews_count || 0})
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.viewBtn}
                      activeOpacity={0.85}
                      onPress={() => onSelectFood?.(item)}
                    >
                      <Text style={styles.viewBtnText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
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
    height: 120,
    borderRadius: 16,
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
  foodName: {
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
  hoursText: {
    fontSize: 11,
    color: '#0284c7',
    marginTop: 2,
    fontWeight: '600',
  },
  descText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },
  pricePeriod: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingInlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  viewBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  viewBtnText: {
    color: '#ffffff',
    fontSize: 11,
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