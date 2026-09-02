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

export interface ActivityItem {
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

const ACTIVITY_FILTERS = ['All', 'Island Hopping', 'Snorkeling', 'Caving', 'Boat Rental'];

interface ActivitiesScreenProps {
  onGoBack?: () => void;
  onNavigateTab?: (tab: string) => void;
  onSelectActivity?: (item: ActivityItem) => void;
}

export default function ActivitiesScreen({
  onGoBack,
  onNavigateTab,
  onSelectActivity,
}: ActivitiesScreenProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching activities:', error.message);
        return;
      }

      if (data) {
        // Only include activity and adventure items (exclude hotels and food)
        const activitiesOnly = data
          .filter((d: any) => d.is_active !== false)
          .filter((d: any) => {
            const cat = (d.category || '').toLowerCase();
            const isHotel =
              cat.includes('accommodation') ||
              cat.includes('hotel') ||
              cat.includes('stay') ||
              cat.includes('resort');
            const isFood =
              cat.includes('food') ||
              cat.includes('dining') ||
              cat.includes('restaurant') ||
              cat.includes('cafe');

            return !isHotel && !isFood;
          });

        setActivities(activitiesOnly);
      }
    } catch (err) {
      console.log('Activity load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel('realtime-activities-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destinations' },
        () => fetchActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredActivities = activities.filter((act) => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (act.name || '').toLowerCase().includes(q);
    const descMatch = (act.description || '').toLowerCase().includes(q);
    const matchesSearch = q === '' || nameMatch || descMatch;

    if (!matchesSearch) return false;

    if (activeFilter === 'All') return true;
    const cat = (act.category || '').toLowerCase();
    const name = (act.name || '').toLowerCase();

    if (activeFilter === 'Island Hopping') {
      return cat.includes('island') || cat.includes('boat') || name.includes('island');
    }
    if (activeFilter === 'Snorkeling') {
      return cat.includes('snorkel') || cat.includes('marine') || name.includes('snorkel') || name.includes('reef');
    }
    if (activeFilter === 'Caving') {
      return cat.includes('cave') || name.includes('cave');
    }
    if (activeFilter === 'Boat Rental') {
      return cat.includes('boat') || name.includes('boat') || name.includes('charter');
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" />

      {/* Header Banner */}
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
            <Text style={styles.headerTitle}>Activities & Adventures</Text>
            <Text style={styles.headerSubtitle}>
              Experience island tours, diving spots, and certified eco-guides
            </Text>
          </View>

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search tours, snorkeling, boat rentals..."
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
            data={ACTIVITY_FILTERS}
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

      {/* Activities Feed */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Syncing activities...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.cardList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchActivities();
              }}
              tintColor="#0284c7"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="compass-outline" size={54} color="#bae6fd" />
              <Text style={styles.emptyTitle}>No Activities Listed Yet</Text>
              <Text style={styles.emptySub}>
                Published adventure packages and tours will show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const displayImg =
              item.image_url ||
              (item.images && item.images.length > 0 ? item.images[0] : null) ||
              'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80';

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => onSelectActivity?.(item)}
              >
                <Image source={{ uri: displayImg }} style={styles.cardImage} />

                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.categoryBadge}>
                      {item.lgu_status || 'MUNICIPAL TOUR'}
                    </Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color="#f59e0b" />
                      <Text style={styles.ratingText}>{item.rating || 4.9}</Text>
                    </View>
                  </View>

                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <Text style={styles.locationText} numberOfLines={1}>
                    <Ionicons name="location-outline" size={11} color="#64748b" />{' '}
                    {item.barangay ? `Brgy. ${item.barangay}, Calatrava` : 'Calatrava, Romblon'}
                  </Text>

                  <Text style={styles.descText} numberOfLines={2}>
                    {item.description || 'Guided eco-tourism and adventure package certified by Calatrava Tourism Desk.'}
                  </Text>

                  <View style={styles.cardBottomRow}>
                    <View>
                      <Text style={styles.rateLabel}>Standard Rate</Text>
                      <Text style={styles.rateValue}>
                        {item.eco_fee ? `₱${item.eco_fee}` : 'Free Entry'}
                      </Text>
                    </View>

                    <View style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>Book Activity</Text>
                      <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                    </View>
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
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    marginBottom: 12,
  },
  cardImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 14,
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
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  descText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginTop: 6,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rateLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  rateValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0284c7',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionBtnText: {
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