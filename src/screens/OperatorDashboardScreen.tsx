import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  ScrollView,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface ManifestPerson {
  name: string;
  age: number | string;
  gender: string;
}

interface BookingRecord {
  id: string;
  contact_person: string;
  contact_phone: string;
  pax_count: number;
  trip_date: string;
  trip_time: string;
  booking_type: string;
  total_fare: number;
  lgu_eco_fee?: number;
  status: 'pending' | 'accepted' | 'dispatched' | 'completed' | 'cancelled';
  passenger_manifest: ManifestPerson[];
  fleet_unit_id?: string;
  destinations?: { name: string; barangay: string };
  fleet_units?: { unit_name: string; assigned_person: string };
}

interface FleetUnit {
  id: string;
  unit_name: string;
  assigned_person: string;
  contact_phone: string;
  capacity: number;
  status: 'available' | 'on_trip' | 'maintenance';
}

interface OperatorDashboardProps {
  operatorId?: string;
  operatorName?: string;
  onLogout: () => void;
}

export default function OperatorDashboardScreen({
  operatorId,
  operatorName = 'Calatrava Boatmen Association (BAPOR)',
  onLogout,
}: OperatorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'fleet'>('requests');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'accepted' | 'completed'>('pending');

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [fleet, setFleet] = useState<FleetUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);

  // Add Fleet Unit Modal State
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newAssignedPerson, setNewAssignedPerson] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newCapacity, setNewCapacity] = useState('6');
  const [savingUnit, setSavingUnit] = useState(false);

  // Walk-in / Port Booking Modal State
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInContact, setWalkInContact] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPax, setWalkInPax] = useState('4');
  const [walkInFare, setWalkInFare] = useState('1500');
  const [walkInDest, setWalkInDest] = useState('Guindawahan Island Tour');
  const [walkInPassengers, setWalkInPassengers] = useState<ManifestPerson[]>([
    { name: '', age: '', gender: 'M' },
  ]);
  const [savingWalkIn, setSavingWalkIn] = useState(false);

  const loadOperatorData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Bookings
      let bookingQuery = supabase
        .from('bookings')
        .select(`
          *,
          destinations ( name, barangay ),
          fleet_units ( unit_name, assigned_person )
        `)
        .order('created_at', { ascending: false });

      if (operatorId) {
        bookingQuery = bookingQuery.eq('operator_id', operatorId);
      }

      const { data: bookingData, error: bError } = await bookingQuery;
      if (bError) console.log('Bookings fetch error:', bError.message);
      if (bookingData) setBookings(bookingData);

      // 2. Fetch Fleet Units
      let fleetQuery = supabase.from('fleet_units').select('*').order('unit_name');
      if (operatorId) {
        fleetQuery = fleetQuery.eq('operator_id', operatorId);
      }
      const { data: fleetData, error: fError } = await fleetQuery;
      if (fError) console.log('Fleet fetch error:', fError.message);
      if (fleetData) setFleet(fleetData);
    } catch (err) {
      console.log('Operator load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOperatorData();

    const bookingChannel = supabase
      .channel('operator-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadOperatorData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_units' }, () => {
        loadOperatorData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bookingChannel);
    };
  }, [operatorId]);

  // Hotline Dialing
  const handleCallHotline = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call on this device.');
    });
  };

  // Add Fleet Unit to Supabase
  const handleSaveUnit = async () => {
    if (!newUnitName.trim() || !newAssignedPerson.trim() || !newContactPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter the unit name, captain/driver, and contact number.');
      return;
    }

    setSavingUnit(true);
    try {
      const { error } = await supabase.from('fleet_units').insert([
        {
          operator_id: operatorId || null,
          unit_name: newUnitName.trim(),
          assigned_person: newAssignedPerson.trim(),
          contact_phone: newContactPhone.trim(),
          capacity: parseInt(newCapacity, 10) || 6,
          status: 'available',
        },
      ]);

      if (error) throw error;

      setShowAddUnitModal(false);
      setNewUnitName('');
      setNewAssignedPerson('');
      setNewContactPhone('');
      setNewCapacity('6');
      Alert.alert('Success', 'Fleet unit added successfully.');
      loadOperatorData();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to register unit.');
    } finally {
      setSavingUnit(false);
    }
  };

  // Create Walk-in Port Booking
  const handleSaveWalkIn = async () => {
    if (!walkInContact.trim() || !walkInPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter primary passenger name and contact number.');
      return;
    }

    setSavingWalkIn(true);
    try {
      const paxCount = parseInt(walkInPax, 10) || 1;
      const validManifest = walkInPassengers
        .filter((p) => p.name.trim().length > 0)
        .map((p) => ({
          name: p.name.trim(),
          age: parseInt(String(p.age), 10) || 0,
          gender: p.gender || 'M',
        }));

      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const { error } = await supabase.from('bookings').insert([
        {
          operator_id: operatorId || null,
          contact_person: walkInContact.trim(),
          contact_phone: walkInPhone.trim(),
          pax_count: paxCount,
          total_fare: parseFloat(walkInFare) || 1500,
          lgu_eco_fee: paxCount * 50,
          booking_type: 'boat_tour',
          trip_date: today,
          trip_time: nowTime,
          passenger_manifest: validManifest.length > 0 ? validManifest : [{ name: walkInContact.trim(), age: 30, gender: 'M' }],
          status: 'pending',
        },
      ]);

      if (error) throw error;

      setShowWalkInModal(false);
      setWalkInContact('');
      setWalkInPhone('');
      setWalkInPax('4');
      setWalkInPassengers([{ name: '', age: '', gender: 'M' }]);
      Alert.alert('Booking Created', 'Walk-in booking and manifest registered in system.');
      loadOperatorData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to register walk-in booking.');
    } finally {
      setSavingWalkIn(false);
    }
  };

  // Status & Assignment Actions
  const handleUpdateStatus = async (bookingId: string, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: nextStatus })
        .eq('id', bookingId);

      if (error) throw error;
      loadOperatorData();
    } catch (err: any) {
      Alert.alert('Update Error', err.message);
    }
  };

  const handleAssignUnit = async (unitId: string) => {
    if (!assigningBookingId) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          fleet_unit_id: unitId,
          status: 'accepted',
        })
        .eq('id', assigningBookingId);

      if (error) throw error;

      await supabase
        .from('fleet_units')
        .update({ status: 'on_trip' })
        .eq('id', unitId);

      setShowAssignModal(false);
      setAssigningBookingId(null);
      Alert.alert('Trip Dispatched', 'Vessel assigned and trip marked active.');
      loadOperatorData();
    } catch (err: any) {
      Alert.alert('Assignment Error', err.message);
    }
  };

  const handleToggleFleetStatus = async (unit: FleetUnit) => {
    const nextStatus = unit.status === 'available' ? 'maintenance' : 'available';

    try {
      const { error } = await supabase
        .from('fleet_units')
        .update({ status: nextStatus })
        .eq('id', unit.id);

      if (error) throw error;
      loadOperatorData();
    } catch (err: any) {
      Alert.alert('Status Error', err.message);
    }
  };

  // Derived Daily Metrics
  const totalCompletedTrips = bookings.filter((b) => b.status === 'completed').length;
  const totalPassengersServed = bookings
    .filter((b) => b.status === 'completed' || b.status === 'accepted' || b.status === 'dispatched')
    .reduce((sum, b) => sum + (Number(b.pax_count) || 0), 0);
  const totalRevenue = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (Number(b.total_fare) || 0), 0);

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === 'pending') return b.status === 'pending';
    if (filterStatus === 'accepted') return b.status === 'accepted' || b.status === 'dispatched';
    if (filterStatus === 'completed') return b.status === 'completed' || b.status === 'cancelled';
    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" />

      {/* Operator Main Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.accreditationRow}>
              <Ionicons name="shield-checkmark" size={12} color="#bae6fd" />
              <Text style={styles.accreditationText}>LGU ACCREDITED OPERATOR</Text>
            </View>
            <Text style={styles.operatorTitle} numberOfLines={1}>
              {operatorName}
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* 1. Live Sea & Coast Guard Condition Banner */}
        <View style={styles.seaConditionCard}>
          <View style={styles.seaIndicatorDot} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.seaConditionTitle}>Sea Status: Calm & Safe (Normal Ops)</Text>
            <Text style={styles.seaConditionSub}>Coast Guard & MDRRMO Clearance active for Calatrava Bay</Text>
          </View>
          <Ionicons name="sunny" size={18} color="#f59e0b" />
        </View>

        {/* 2. Key Operational Stat Counters */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {bookings.filter((b) => b.status === 'pending').length}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {bookings.filter((b) => b.status === 'accepted' || b.status === 'dispatched').length}
            </Text>
            <Text style={styles.statLabel}>Active Trips</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {fleet.filter((f) => f.status === 'available').length}
            </Text>
            <Text style={styles.statLabel}>Ready Units</Text>
          </View>
        </View>

        {/* 3. Primary Tab Switcher */}
        <View style={styles.viewSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'requests' && styles.switchTabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Ionicons
              name="calendar-outline"
              size={15}
              color={activeTab === 'requests' ? '#0284c7' : '#ffffff'}
            />
            <Text
              style={[
                styles.switchTabText,
                activeTab === 'requests' && styles.switchTabTextActive,
              ]}
            >
              Trip Bookings ({bookings.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'fleet' && styles.switchTabActive]}
            onPress={() => setActiveTab('fleet')}
          >
            <MaterialCommunityIcons
              name="sail-boat"
              size={16}
              color={activeTab === 'fleet' ? '#0284c7' : '#ffffff'}
            />
            <Text
              style={[styles.switchTabText, activeTab === 'fleet' && styles.switchTabTextActive]}
            >
              Fleet & Units ({fleet.length})
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Main Body Content */}
      {activeTab === 'requests' ? (
        <View style={styles.body}>
          {/* Quick Action: Log Walk-in Passenger Manifest */}
          <View style={styles.actionHeaderRow}>
            <View style={styles.subFilterRow}>
              {(['pending', 'accepted', 'completed'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setFilterStatus(status)}
                  style={[
                    styles.filterPill,
                    filterStatus === status && styles.filterPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      filterStatus === status && styles.filterPillTextActive,
                    ]}
                  >
                    {status === 'pending'
                      ? 'Pending'
                      : status === 'accepted'
                      ? 'Active'
                      : 'Completed'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.walkInBtn}
              onPress={() => setShowWalkInModal(true)}
              activeOpacity={0.85}
            >
              <Feather name="plus-circle" size={14} color="#0284c7" />
              <Text style={styles.walkInBtnText}>Walk-in</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0284c7" />
            </View>
          ) : (
            <FlatList
              data={filteredBookings}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listPadding}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadOperatorData();
                  }}
                  tintColor="#0284c7"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name="clipboard-outline" size={44} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No {filterStatus} trips</Text>
                  <Text style={styles.emptySub}>
                    Incoming tourist booking requests or port walk-ins will appear here.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyWalkInBtn}
                    onPress={() => setShowWalkInModal(true)}
                  >
                    <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.emptyWalkInBtnText}>Create Walk-in Booking</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.bookingCard}>
                  <View style={styles.bookingHeaderRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {item.booking_type === 'boat_tour' ? 'ISLAND HOPPING' : 'LAND CHARTER'}
                      </Text>
                    </View>
                    <Text style={styles.bookingDateText}>
                      {item.trip_date} • {item.trip_time}
                    </Text>
                  </View>

                  <Text style={styles.destName}>
                    {item.destinations?.name || 'Guindawahan Island Tour'}
                  </Text>
                  <Text style={styles.guestInfo}>
                    Contact: <Text style={{ fontWeight: '700' }}>{item.contact_person}</Text> (
                    {item.contact_phone})
                  </Text>

                  <View style={styles.infoBadgeRow}>
                    <View style={styles.detailBadge}>
                      <Ionicons name="people-outline" size={13} color="#0284c7" />
                      <Text style={styles.detailBadgeText}>{item.pax_count} Pax</Text>
                    </View>

                    <View style={styles.detailBadge}>
                      <Ionicons name="cash-outline" size={13} color="#0284c7" />
                      <Text style={styles.detailBadgeText}>₱{Number(item.total_fare).toLocaleString()}</Text>
                    </View>

                    {item.lgu_eco_fee ? (
                      <View style={styles.ecoBadge}>
                        <Ionicons name="leaf-outline" size={12} color="#16a34a" />
                        <Text style={styles.ecoBadgeText}>Eco: ₱{item.lgu_eco_fee}</Text>
                      </View>
                    ) : null}
                  </View>

                  {item.fleet_units?.unit_name ? (
                    <View style={styles.assignedBox}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text style={styles.assignedText}>
                        Assigned: {item.fleet_units.unit_name} ({item.fleet_units.assigned_person})
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.manifestBtn}
                      onPress={() => {
                        setSelectedBooking(item);
                        setShowManifestModal(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="document-text-outline" size={14} color="#0284c7" />
                      <Text style={styles.manifestBtnText}>Coast Guard Manifest</Text>
                    </TouchableOpacity>

                    {item.status === 'pending' && (
                      <TouchableOpacity
                        style={styles.assignUnitBtn}
                        onPress={() => {
                          setAssigningBookingId(item.id);
                          setShowAssignModal(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.assignUnitBtnText}>Assign Unit</Text>
                      </TouchableOpacity>
                    )}

                    {item.status === 'accepted' && (
                      <TouchableOpacity
                        style={styles.completeBtn}
                        onPress={() => handleUpdateStatus(item.id, 'completed')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.completeBtnText}>Complete Trip</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      ) : (
        /* Fleet & Unit Management View */
        <View style={styles.body}>
          {/* Header Action to Add Unit */}
          <View style={styles.fleetHeaderBar}>
            <Text style={styles.fleetSummaryText}>Registered Vessels & Vehicles</Text>
            <TouchableOpacity
              style={styles.addUnitBtn}
              onPress={() => setShowAddUnitModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 2 }} />
              <Text style={styles.addUnitBtnText}>Add Unit</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={fleet}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPadding}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="sail-boat" size={48} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Fleet Units Registered</Text>
                <Text style={styles.emptySub}>
                  Register your pump boats, speedboats, or TODA vehicles to start accepting trip bookings.
                </Text>
                <TouchableOpacity
                  style={styles.emptyWalkInBtn}
                  onPress={() => setShowAddUnitModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.emptyWalkInBtnText}>Add First Unit</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.fleetCard}>
                <View style={styles.fleetTop}>
                  <View>
                    <Text style={styles.unitName}>{item.unit_name}</Text>
                    <Text style={styles.captainText}>
                      Captain/Driver: {item.assigned_person} • {item.contact_phone}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'available'
                        ? styles.statusPillReady
                        : item.status === 'on_trip'
                        ? styles.statusPillTrip
                        : styles.statusPillMaint,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        item.status === 'available'
                          ? styles.statusTextReady
                          : item.status === 'on_trip'
                          ? styles.statusTextTrip
                          : styles.statusTextMaint,
                      ]}
                    >
                      {item.status === 'available'
                        ? 'Available'
                        : item.status === 'on_trip'
                        ? 'On Trip'
                        : 'Maintenance'}
                    </Text>
                  </View>
                </View>

                <View style={styles.fleetFooter}>
                  <Text style={styles.capText}>Max Capacity: {item.capacity} Passengers</Text>

                  <TouchableOpacity
                    style={styles.toggleStatusBtn}
                    onPress={() => handleToggleFleetStatus(item)}
                  >
                    <Text style={styles.toggleStatusBtnText}>
                      {item.status === 'available' ? 'Set Maintenance' : 'Set Ready'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* Bottom Emergency Hotlines Quick Action Bar */}
      <View style={styles.hotlineBottomBar}>
        <Text style={styles.hotlineLabel}>DIRECT EMERGENCY DIAL:</Text>
        <View style={styles.hotlineRow}>
          <TouchableOpacity
            style={styles.hotlinePill}
            onPress={() => handleCallHotline('+639987654321')}
          >
            <Ionicons name="boat" size={13} color="#d97706" />
            <Text style={styles.hotlinePillText}>Coast Guard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.hotlinePill}
            onPress={() => handleCallHotline('+639123456789')}
          >
            <Ionicons name="shield-checkmark" size={13} color="#dc2626" />
            <Text style={styles.hotlinePillText}>MDRRMO Rescue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.hotlinePill}
            onPress={() => handleCallHotline('+639201112233')}
          >
            <Ionicons name="business" size={13} color="#0284c7" />
            <Text style={styles.hotlinePillText}>Tourism Desk</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal 1: Add Fleet Unit */}
      <Modal
        visible={showAddUnitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddUnitModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.manifestHeader}>
              <Text style={styles.modalTitle}>Register Fleet Unit</Text>
              <TouchableOpacity onPress={() => setShowAddUnitModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>UNIT / BOAT NAME</Text>
            <TextInput
              placeholder="e.g. MB Guindawahan 01 or TODA Unit 14"
              placeholderTextColor="#94a3b8"
              value={newUnitName}
              onChangeText={setNewUnitName}
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>ASSIGNED CAPTAIN / DRIVER</Text>
            <TextInput
              placeholder="e.g. Mario Dela Cruz"
              placeholderTextColor="#94a3b8"
              value={newAssignedPerson}
              onChangeText={setNewAssignedPerson}
              style={styles.modalInput}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                <TextInput
                  placeholder="0912 345 6789"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={newContactPhone}
                  onChangeText={setNewContactPhone}
                  style={styles.modalInput}
                />
              </View>

              <View style={{ width: 100 }}>
                <Text style={styles.inputLabel}>MAX PAX</Text>
                <TextInput
                  placeholder="6"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={newCapacity}
                  onChangeText={setNewCapacity}
                  style={styles.modalInput}
                />
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowAddUnitModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleSaveUnit}
                disabled={savingUnit}
              >
                {savingUnit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveModalBtnText}>Save Unit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal 2: Log Port Walk-in Booking & Manifest */}
      <Modal
        visible={showWalkInModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWalkInModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.manifestHeader}>
              <View>
                <Text style={styles.modalTitle}>New Walk-in Booking</Text>
                <Text style={styles.modalSub}>Log on-site passengers for Coast Guard clearance</Text>
              </View>
              <TouchableOpacity onPress={() => setShowWalkInModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>LEAD PASSENGER NAME</Text>
              <TextInput
                placeholder="e.g. Maria Santos"
                placeholderTextColor="#94a3b8"
                value={walkInContact}
                onChangeText={setWalkInContact}
                style={styles.modalInput}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CONTACT NUMBER</Text>
                  <TextInput
                    placeholder="0912 345 6789"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    value={walkInPhone}
                    onChangeText={setWalkInPhone}
                    style={styles.modalInput}
                  />
                </View>

                <View style={{ width: 90 }}>
                  <Text style={styles.inputLabel}>PAX COUNT</Text>
                  <TextInput
                    placeholder="4"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={walkInPax}
                    onChangeText={(val) => {
                      setWalkInPax(val);
                      const count = parseInt(val, 10) || 1;
                      const arr = Array.from({ length: Math.min(count, 15) }, (_, i) => ({
                        name: walkInPassengers[i]?.name || '',
                        age: walkInPassengers[i]?.age || '',
                        gender: walkInPassengers[i]?.gender || 'M',
                      }));
                      setWalkInPassengers(arr);
                    }}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>TOTAL CHARTER FARE (PHP)</Text>
              <TextInput
                placeholder="1500"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={walkInFare}
                onChangeText={setWalkInFare}
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>PASSENGER MANIFEST LIST</Text>
              {walkInPassengers.map((pax, index) => (
                <View key={index} style={styles.manifestInputRow}>
                  <Text style={styles.manifestPaxNum}>#{index + 1}</Text>
                  <TextInput
                    placeholder="Full Name"
                    placeholderTextColor="#94a3b8"
                    value={pax.name}
                    onChangeText={(t) => {
                      const updated = [...walkInPassengers];
                      updated[index].name = t;
                      setWalkInPassengers(updated);
                    }}
                    style={[styles.modalInput, { flex: 2, marginBottom: 0 }]}
                  />
                  <TextInput
                    placeholder="Age"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={String(pax.age)}
                    onChangeText={(t) => {
                      const updated = [...walkInPassengers];
                      updated[index].age = t;
                      setWalkInPassengers(updated);
                    }}
                    style={[styles.modalInput, { width: 55, marginBottom: 0 }]}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowWalkInModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleSaveWalkIn}
                disabled={savingWalkIn}
              >
                {savingWalkIn ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveModalBtnText}>Confirm Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal 3: View Coast Guard Passenger Manifest */}
      <Modal
        visible={showManifestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManifestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.manifestHeader}>
              <View>
                <Text style={styles.modalTitle}>Coast Guard Manifest</Text>
                <Text style={styles.modalSub}>Official MDRRMO Boarding Record</Text>
              </View>
              <TouchableOpacity onPress={() => setShowManifestModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {selectedBooking?.passenger_manifest &&
              selectedBooking.passenger_manifest.length > 0 ? (
                selectedBooking.passenger_manifest.map((pax, index) => (
                  <View key={index} style={styles.manifestItemRow}>
                    <View style={styles.paxNumBadge}>
                      <Text style={styles.paxNumText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.paxName}>{pax.name || 'Unnamed Passenger'}</Text>
                      <Text style={styles.paxMeta}>
                        Age: {pax.age || 'N/A'} • Gender: {pax.gender || 'N/A'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                    Primary Contact: {selectedBooking?.contact_person} ({selectedBooking?.pax_count} Pax)
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeManifestBtn}
              onPress={() => setShowManifestModal(false)}
            >
              <Text style={styles.closeManifestBtnText}>Close Record</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 4: Assign Unit */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.manifestHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Available Vessel</Text>
                <Text style={styles.modalSub}>Select unit for this trip dispatch</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {fleet.filter((u) => u.status === 'available').length === 0 ? (
                <Text style={{ textAlign: 'center', marginVertical: 20, color: '#64748b' }}>
                  No available units currently ready for dispatch.
                </Text>
              ) : (
                fleet
                  .filter((u) => u.status === 'available')
                  .map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={styles.selectUnitCard}
                      onPress={() => handleAssignUnit(unit.id)}
                    >
                      <View>
                        <Text style={styles.unitNameText}>{unit.unit_name}</Text>
                        <Text style={styles.unitCapText}>
                          Captain: {unit.assigned_person} • Max {unit.capacity} Pax
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward-circle" size={24} color="#0284c7" />
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accreditationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accreditationText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#e0f2fe',
    letterSpacing: 0.5,
  },
  operatorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seaConditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  seaIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ade80',
  },
  seaConditionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  seaConditionSub: {
    fontSize: 10,
    color: '#e0f2fe',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 10,
    color: '#e0f2fe',
    fontWeight: '600',
    marginTop: 2,
  },
  viewSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    borderRadius: 12,
    padding: 3,
  },
  switchTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  switchTabActive: {
    backgroundColor: '#ffffff',
  },
  switchTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  switchTabTextActive: {
    color: '#0284c7',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#0284c7',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  walkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  walkInBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  fleetHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fleetSummaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  addUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addUnitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  listPadding: {
    paddingBottom: 70,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bookingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
  },
  bookingDateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  destName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  guestInfo: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  infoBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  ecoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ecoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  assignedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  assignedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  manifestBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  manifestBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  assignUnitBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  assignUnitBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  completeBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  completeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  fleetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    marginBottom: 10,
  },
  fleetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  unitName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  captainText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillReady: { backgroundColor: '#dcfce7' },
  statusPillTrip: { backgroundColor: '#e0f2fe' },
  statusPillMaint: { backgroundColor: '#fee2e2' },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  statusTextReady: { color: '#16a34a' },
  statusTextTrip: { color: '#0284c7' },
  statusTextMaint: { color: '#dc2626' },
  fleetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  capText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleStatusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  toggleStatusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  hotlineBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 8,
  },
  hotlineLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  hotlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hotlinePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hotlinePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 260,
  },
  emptyWalkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
  },
  emptyWalkInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    elevation: 8,
  },
  manifestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
    marginTop: 8,
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
  manifestInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  manifestPaxNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    width: 24,
  },
  manifestItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  paxNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paxNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  paxName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  paxMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 10,
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
  saveModalBtn: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeManifestBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closeManifestBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  selectUnitCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  unitNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  unitCapText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});