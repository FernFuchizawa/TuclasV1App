import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
  Linking,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface TransportMode {
  id: 'tricycle' | 'scooter' | 'van';
  label: string;
}

export interface RouteFareItem {
  id: string;
  mode: 'tricycle' | 'scooter' | 'van';
  title: string;
  route: string;
  duration: string;
  regular_fare: string;
  special_fare: string;
  discounted_fare: string;
  notes: string;
  dispatcher_contact: string;
  terminal_location: string;
}

const MODES: TransportMode[] = [
  { id: 'tricycle', label: 'Tricycle' },
  { id: 'scooter', label: 'Motorcycle' },
  { id: 'van', label: 'Van' },
];

export default function TransportationScreen({ onGoBack }: { onGoBack?: () => void }) {
  const [selectedMode, setSelectedMode] = useState<'tricycle' | 'scooter' | 'van'>('tricycle');
  const [searchQuery, setSearchQuery] = useState('');
  const [tariffs, setTariffs] = useState<RouteFareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFareItem, setSelectedFareItem] = useState<RouteFareItem | null>(null);

  const fetchTariffs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transport_tariffs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.log('Tariff fetch error:', error.message);
        return;
      }

      if (data && data.length > 0) {
        setTariffs(data);
      }
    } catch (err) {
      console.log('Error loading tariffs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTariffs();

    const channel = supabase
      .channel('transport-tariffs-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transport_tariffs' },
        () => fetchTariffs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCallDispatcher = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to dial from this device.');
    });
  };

  const filteredRoutes = tariffs.filter((item) => {
    const matchesMode = item.mode === selectedMode;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      item.title.toLowerCase().includes(q) ||
      item.route.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q));

    return matchesMode && matchesSearch;
  });

  return (
    <LinearGradient
      colors={['#0284c7', '#0ea5e9', '#38bdf8', '#e0f2fe']}
      locations={[0, 0.28, 0.58, 1]}
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
                fetchTariffs();
              }}
              tintColor="#ffffff"
            />
          }
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#0284c7" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Transportation & Tariffs</Text>
            <Text style={styles.headerSubtitle}>
              Official LGU-regulated commuter fares and land charters
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search destination barangay, airport, terminal..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          {/* Mode Switcher */}
          <View style={styles.modesWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modesContainer}
            >
              {MODES.map((mode) => {
                const isSelected = selectedMode === mode.id;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    style={[styles.modeCard, isSelected ? styles.modeCardActive : styles.modeCardInactive]}
                    onPress={() => setSelectedMode(mode.id)}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name={
                        mode.id === 'tricycle'
                          ? 'rickshaw'
                          : mode.id === 'scooter'
                          ? 'moped-outline'
                          : 'van-utility'
                      }
                      size={28}
                      color={isSelected ? '#0284c7' : '#ffffff'}
                    />
                    <Text style={[styles.modeLabel, isSelected ? styles.modeLabelActive : styles.modeLabelInactive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Content Feed */}
          <View style={styles.contentCard}>
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0284c7" />
                <Text style={styles.loadingText}>Syncing official tariffs...</Text>
              </View>
            ) : (
              <View style={styles.cardsList}>
                {filteredRoutes.map((card) => (
                  <View key={card.id} style={styles.fareCard}>
                    <View style={styles.fareCardHeader}>
                      <Text style={styles.cardTitle}>{card.title}</Text>
                      <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>LGU TARIFF</Text>
                      </View>
                    </View>

                    <Text style={styles.cardRoute}>{card.route}</Text>
                    <Text style={styles.cardDuration}>
                      <Ionicons name="time-outline" size={12} color="#64748b" /> {card.duration}
                    </Text>

                    <View style={styles.cardBottomRow}>
                      <View>
                        <Text style={styles.fareLabel}>Standard Fare</Text>
                        <Text style={styles.cardFare}>{card.regular_fare}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.viewFaresBtn}
                        activeOpacity={0.85}
                        onPress={() => setSelectedFareItem(card)}
                      >
                        <Text style={styles.viewFaresText}>View Tariff</Text>
                        <Ionicons name="chevron-forward" size={13} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {filteredRoutes.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="bus-outline" size={42} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No Tariffs Listed</Text>
                    <Text style={styles.emptySub}>
                      Official tariffs added by the LGU Admin in the portal will show up here.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Modal */}
      <Modal
        visible={!!selectedFareItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedFareItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedFareItem && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalBadge}>OFFICIAL FARE BREAKDOWN</Text>
                    <Text style={styles.modalTitle}>{selectedFareItem.title}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedFareItem(null)}>
                    <Ionicons name="close" size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={styles.tariffGrid}>
                  <View style={styles.tariffRow}>
                    <Text style={styles.tariffLabel}>Regular Commuter Fare</Text>
                    <Text style={styles.tariffValue}>{selectedFareItem.regular_fare}</Text>
                  </View>
                  <View style={styles.tariffDivider} />
                  <View style={styles.tariffRow}>
                    <Text style={styles.tariffLabel}>Special Charter</Text>
                    <Text style={styles.tariffValue}>{selectedFareItem.special_fare}</Text>
                  </View>
                  <View style={styles.tariffDivider} />
                  <View style={styles.tariffRow}>
                    <Text style={styles.tariffLabel}>Discounted (Senior/Student/PWD)</Text>
                    <Text style={[styles.tariffValue, { color: '#16a34a' }]}>
                      {selectedFareItem.discounted_fare || '20% off standard'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Terminal Location:</Text>
                  <Text style={styles.infoSub}>{selectedFareItem.terminal_location || 'Municipal Terminal'}</Text>
                </View>

                {selectedFareItem.dispatcher_contact ? (
                  <TouchableOpacity
                    style={styles.callDispatcherBtn}
                    onPress={() => handleCallDispatcher(selectedFareItem.dispatcher_contact)}
                  >
                    <Ionicons name="call" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.callDispatcherText}>Call Dispatcher ({selectedFareItem.dispatcher_contact})</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 18,
    marginBottom: 14,
    elevation: 3,
  },
  header: { paddingHorizontal: 18, marginBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: { fontSize: 12.5, color: '#e0f2fe', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    marginHorizontal: 18,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  modesWrapper: { marginBottom: 12 },
  modesContainer: { paddingHorizontal: 18, gap: 12 },
  modeCard: {
    width: 90,
    height: 74,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeCardActive: { backgroundColor: '#ffffff', elevation: 4 },
  modeCardInactive: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  modeLabel: { fontSize: 11, marginTop: 3, fontWeight: '600' },
  modeLabelActive: { color: '#0284c7', fontWeight: '800' },
  modeLabelInactive: { color: '#ffffff' },
  contentCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 90,
    minHeight: 520,
  },
  centerContainer: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 12, color: '#64748b' },
  cardsList: { gap: 12 },
  fareCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
  },
  fareCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  badgePill: { backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgePillText: { fontSize: 9, fontWeight: '800', color: '#0284c7' },
  cardRoute: { fontSize: 13, color: '#475569', fontWeight: '600', marginTop: 3 },
  cardDuration: { fontSize: 11, color: '#64748b', marginTop: 3 },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  fareLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  cardFare: { fontSize: 13.5, fontWeight: '800', color: '#16a34a' },
  viewFaresBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  viewFaresText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#475569', marginTop: 8 },
  emptySub: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  modalBadge: { fontSize: 9, fontWeight: '800', color: '#0284c7', letterSpacing: 0.5 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  tariffGrid: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  tariffRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  tariffDivider: { height: 1, backgroundColor: '#f1f5f9' },
  tariffLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },
  tariffValue: { fontSize: 12.5, fontWeight: '800', color: '#0f172a' },
  infoCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, marginBottom: 16 },
  infoTitle: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  infoSub: { fontSize: 11.5, color: '#1e293b', marginTop: 1 },
  callDispatcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 14,
  },
  callDispatcherText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
});