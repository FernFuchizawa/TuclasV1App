import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

interface ProfileScreenProps {
  onLogout?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export default function ProfileScreen({ onLogout, onNavigateTab }: ProfileScreenProps) {
  const [fullName, setFullName] = useState('Tourist Explorer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('Not provided');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState('Member');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.log('Supabase user error:', error.message);
      }

      if (user) {
        const metadata = user.user_metadata || {};
        const nameVal = metadata.full_name || 'Tourist Explorer';
        const phoneVal = metadata.phone_number || user.phone || 'Not provided';
        const avatarVal = metadata.avatar_url || null;

        setFullName(nameVal);
        setEmail(user.email || 'No email registered');
        setPhone(phoneVal);
        setAvatarUrl(avatarVal);

        setEditName(nameVal);
        setEditPhone(phoneVal === 'Not provided' ? '' : phoneVal);

        if (user.created_at) {
          const dateObj = new Date(user.created_at);
          setCreatedAt(
            dateObj.toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })
          );
        }
      }
    } catch (err: any) {
      console.log('Error loading profile:', err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow gallery access to upload a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setAvatarUrl(selectedUri);

        // Update avatar URL in Supabase metadata
        await supabase.auth.updateUser({
          data: { avatar_url: selectedUri },
        });

        Alert.alert('Success', 'Profile photo updated!');
      }
    } catch (err: any) {
      console.log('Image picker error:', err?.message || err);
      Alert.alert('Error', 'Unable to pick photo.');
    }
  };

  const handleSaveDetails = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Full Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const formattedPhone = editPhone.trim() ? editPhone.trim() : 'Not provided';

      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: editName.trim(),
          phone_number: formattedPhone,
        },
      });

      if (error) throw error;

      setFullName(editName.trim());
      setPhone(formattedPhone);
      setIsEditModalOpen(false);
      Alert.alert('Updated', 'Your personal details have been saved successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Unable to update details.');
    } finally {
      setSaving(false);
    }
  };

  const handleCallHotline = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call on this device.');
    });
  };

  const showEmergencyOptions = () => {
    Alert.alert(
      'Calatrava Emergency Hotlines',
      'Select a local emergency unit to call directly:',
      [
        {
          text: 'MDRRMO Rescue (+63 912 345 6789)',
          onPress: () => handleCallHotline('+639123456789'),
        },
        {
          text: 'Calatrava Police (+63 998 765 4321)',
          onPress: () => handleCallHotline('+639987654321'),
        },
        {
          text: 'RHU Health Clinic (+63 920 111 2233)',
          onPress: () => handleCallHotline('+639201112233'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            onLogout?.();
          } catch (err: any) {
            Alert.alert('Sign Out Failed', err?.message || 'Unable to sign out.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'TX';
    const clean = nameStr.trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase() || 'TX';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" />

      {/* Top Gradient Header */}
      <LinearGradient colors={['#0284c7', '#38bdf8']} style={styles.headerBanner}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Account Profile</Text>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => onNavigateTab?.('notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Profile Avatar Card */}
        <View style={styles.avatarRow}>
          <TouchableOpacity activeOpacity={0.8} onPress={handlePickImage} style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Feather name="camera" size={13} color="#ffffff" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 16 }}>
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ alignSelf: 'flex-start' }} />
            ) : (
              <>
                <Text style={styles.userName} numberOfLines={1}>
                  {fullName}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={styles.statusBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#0284c7" />
                    <Text style={styles.statusBadgeText}>Verified Tourist</Text>
                  </View>
                  <Text style={styles.memberSince}>Since {createdAt}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchUserProfile();
            }}
            colors={['#0284c7']}
          />
        }
      >
        {/* Personal Details Header & Edit Trigger */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setEditName(fullName);
              setEditPhone(phone === 'Not provided' ? '' : phone);
              setIsEditModalOpen(true);
            }}
            style={styles.editBtn}
          >
            <Feather name="edit-2" size={13} color="#0284c7" />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Feather name="user" size={18} color="#0284c7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{fullName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Feather name="mail" size={18} color="#0284c7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{email || 'None'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Feather name="phone" size={18} color="#0284c7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Mobile Number</Text>
              <Text style={styles.infoValue}>{phone}</Text>
            </View>
          </View>
        </View>

        {/* Tourism Assistance & Safety */}
        <Text style={styles.sectionHeader}>CALATRAVA TOURISM & SUPPORT</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={showEmergencyOptions}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="call-outline" size={18} color="#ef4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuTitle}>Emergency Hotlines</Text>
              <Text style={styles.menuSubtitle}>Direct dial MDRRMO, Police & Clinic</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => onNavigateTab?.('bookings')}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#e0f2fe' }]}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={18} color="#0284c7" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuTitle}>My Tour Passes & Bookings</Text>
              <Text style={styles.menuSubtitle}>Check boat permits & reservation QR</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => onNavigateTab?.('transportation')}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="bus-outline" size={18} color="#16a34a" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuTitle}>Municipal Transport & Tariffs</Text>
              <Text style={styles.menuSubtitle}>Official tricycle, jeepney & van rates</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <Text style={styles.sectionHeader}>APPLICATION</Text>
        <View style={styles.card}>
          <View style={styles.menuRow}>
            <View style={styles.iconCircle}>
              <Feather name="info" size={18} color="#0284c7" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuTitle}>TuClas Tourism App</Text>
              <Text style={styles.menuSubtitle}>Version 1.0.0 • Municipality of Calatrava</Text>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutBtn, loggingOut && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleSignOut}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#ef4444" size="small" />
          ) : (
            <>
              <Feather name="log-out" size={18} color="#ef4444" style={{ marginRight: 8 }} />
              <Text style={styles.signOutText}>Sign Out Account</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Details Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Details</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Your full name"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+63 912 345 6789"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                style={styles.modalInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditModalOpen(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveDetails}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  headerBanner: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0284c7',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0284c7',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  memberSince: {
    fontSize: 11,
    color: '#e0f2fe',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '700',
    marginTop: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 48,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    borderRadius: 16,
    height: 50,
    marginTop: 16,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});