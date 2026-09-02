import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export interface DestinationItem {
  id: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  reviewsCount: number;
  entryFee: string;
  priceNote: string;
  image: string;
}

export interface AllDestinationsScreenProps {
  onBack: () => void;
  onSelectDestination: (destination: DestinationItem) => void;
}

const CATEGORY_CHIPS = ['All', 'Island & Lagoon', 'Beach & Coast', 'Caves', 'Waterfalls'];

export default function AllDestinationsScreen({
  onBack,
  onSelectDestination,
}: AllDestinationsScreenProps) {
  const [items, setItems] = useState<DestinationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

const fetchAllDestinations = async () => {
    try {
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) console.log('Error fetching destinations:', error);

      if (data) {
      const formatted: DestinationItem[] = data.map((d: any) => ({
        id: String(d.id),
        name: d.name || 'Destination',
        category: d.category || 'Spot',
        location: d.barangay || 'Calatrava',
        rating: Number(d.rating) || 4.8,
        reviewsCount: d.reviews_count || 0,
        entryFee: d.eco_fee ? `₱${d.eco_fee} Entry Fee` : 'Free Entry',
        priceNote: d.travel_time || '15 mins away',
        image: d.image_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
        images: d.images && d.images.length > 0 ? d.images : (d.image_url ? [d.image_url] : []),
        lgu_status: d.lgu_status,
        description: d.description,
        visitor_advisory: d.visitor_advisory,
        is_popular: d.is_popular,
      }));
      setItems(formatted);
    }
    } catch (err) {
      console.log('Error fetching destinations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllDestinations();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllDestinations();
  };

  const filteredItems = items.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' ||
      d.category.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Destinations</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Search all Calatrava spots..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={(text) => setSearch(text)}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_CHIPS}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedCategory(item)}
              style={[
                styles.chip,
                selectedCategory === item && styles.chipActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === item && styles.chipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284c7']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No destinations found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => onSelectDestination(item)}
            >
              <Image source={{ uri: item.image }} style={styles.cardImage} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={13} color="#f59e0b" />
                    <Text style={styles.ratingText}>{item.rating}</Text>
                  </View>
                </View>

                <Text style={styles.cardLocation}>
                  {item.category} • {item.location}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.feeText}>{item.entryFee}</Text>
                  <Text style={styles.travelText}>{item.priceNote}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  filterRow: {
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  cardBody: {
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  cardLocation: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  feeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  travelText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});