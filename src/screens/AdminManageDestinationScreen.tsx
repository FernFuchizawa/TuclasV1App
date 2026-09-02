import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface AdminManageDestinationProps {
  destination?: any;
  onGoBack: () => void;
  onSaved: () => void;
}

export default function AdminManageDestinationScreen({
  destination,
  onGoBack,
  onSaved,
}: AdminManageDestinationProps) {
  const [name, setName] = useState(destination?.name || '');
  const [category, setCategory] = useState(destination?.category || 'Island & Lagoon');
  const [barangay, setBarangay] = useState(destination?.barangay || 'Brgy. Busay');
  const [ecoFee, setEcoFee] = useState(destination?.eco_fee ? String(destination.eco_fee) : '50');
  const [travelTime, setTravelTime] = useState(destination?.travel_time || '15 mins by boat');
  const [lguStatus, setLguStatus] = useState(destination?.lgu_status || 'LGU Registered');
  const [imageUrl, setImageUrl] = useState(destination?.image_url || '');
  const [description, setDescription] = useState(destination?.description || '');
  const [visitorAdvisory, setVisitorAdvisory] = useState(destination?.visitor_advisory || '');
  const [isPopular, setIsPopular] = useState(destination?.is_popular ?? true);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Destination name is required.');
      return;
    }

    setLoading(true);
    const payload = {
      name: name.trim(),
      category: category.trim(),
      barangay: barangay.trim(),
      eco_fee: parseFloat(ecoFee) || 0,
      travel_time: travelTime.trim(),
      lgu_status: lguStatus.trim(),
      image_url: imageUrl.trim() || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
      description: description.trim(),
      visitor_advisory: visitorAdvisory.trim(),
      is_popular: isPopular,
      updated_at: new Date().toISOString(),
    };

    try {
      let res;
      if (destination?.id) {
        res = await supabase
          .from('destinations')
          .update(payload)
          .eq('id', destination.id);
      } else {
        res = await supabase.from('destinations').insert([payload]);
      }

      if (res.error) throw res.error;

      Alert.alert('Success', `Destination ${destination?.id ? 'updated' : 'created'} successfully!`);
      onSaved();
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {destination ? 'Edit Destination' : 'Add Destination'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
        {/* Toggle Popular Section */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Feature in Popular Section</Text>
            <Text style={styles.switchSubtitle}>Show this card on the main Home screen</Text>
          </View>
          <Switch
            value={isPopular}
            onValueChange={setIsPopular}
            trackColor={{ false: '#cbd5e1', true: '#bae6fd' }}
            thumbColor={isPopular ? '#0284c7' : '#f8fafc'}
          />
        </View>

        {/* Name */}
        <Text style={styles.label}>Destination Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Lapus-Lapus Beach"
          value={name}
          onChangeText={setName}
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Island & Lagoon, Caves, Beach & Coast"
          value={category}
          onChangeText={setCategory}
        />

        {/* Barangay */}
        <Text style={styles.label}>Barangay / Location</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Brgy. Busay"
          value={barangay}
          onChangeText={setBarangay}
        />

        {/* Eco Fee & Travel Time */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Eco Fee (₱)</Text>
            <TextInput
              style={styles.input}
              placeholder="50"
              keyboardType="numeric"
              value={ecoFee}
              onChangeText={setEcoFee}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Travel Time</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 15 mins by boat"
              value={travelTime}
              onChangeText={setTravelTime}
            />
          </View>
        </View>

        {/* LGU Status */}
        <Text style={styles.label}>LGU Status Tag</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. LGU Registered / Certified Eco-Spot"
          value={lguStatus}
          onChangeText={setLguStatus}
        />

        {/* Image URL */}
        <Text style={styles.label}>Cover Image URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://..."
          value={imageUrl}
          onChangeText={setImageUrl}
        />

        {/* Description */}
        <Text style={styles.label}>About this Destination</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Write destination highlights and info..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        {/* Visitor Advisory */}
        <Text style={styles.label}>Visitor Advisory Notice</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Safety advisory, boat guidelines, or environmental rules..."
          value={visitorAdvisory}
          onChangeText={setVisitorAdvisory}
          multiline
          numberOfLines={3}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Destination</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  formContent: {
    padding: 16,
    paddingBottom: 40,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  switchSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  saveButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});