import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

interface ReviewItem {
  id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface DestinationDetailProps {
  destination: any;
  onGoBack: () => void;
  onBookNow?: (destination: any) => void;
}

export default function DestinationDetailScreen({
  destination,
  onGoBack,
  onBookNow,
}: DestinationDetailProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Live Reviews and Ratings State
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [currentRating, setCurrentRating] = useState<number>(destination?.rating || 5.0);
  const [reviewsCount, setReviewsCount] = useState<number>(destination?.reviews_count || 0);

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!destination) return null;

  // Extract clean photos list
  const imageList: string[] =
    destination.images && destination.images.length > 0
      ? destination.images
      : destination.image_url
      ? [destination.image_url]
      : destination.image
      ? [destination.image]
      : ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'];

  // Formatted location string
  const locationDisplay = destination.barangay
    ? `${destination.barangay}, Calatrava, Romblon`
    : destination.location || 'Calatrava, Romblon';

  // Entry fee formatting
  const rawFee = destination.eco_fee ?? destination.entryFee;
  const feeDisplay =
    typeof rawFee === 'number'
      ? rawFee > 0
        ? `₱${rawFee}`
        : 'Free Entry'
      : String(rawFee || '₱20');

  // Fetch verified reviews for this destination
  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('destination_id', destination.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching destination reviews:', error.message);
        return;
      }

      if (data) {
        setReviews(data);
        setReviewsCount(data.length);

        if (data.length > 0) {
          const totalScore = data.reduce((sum, r) => sum + r.rating, 0);
          setCurrentRating(Number((totalScore / data.length).toFixed(1)));
        } else {
          setCurrentRating(5.0);
        }
      }
    } catch (err) {
      console.log('Review loading error:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchReviews();

    // Supabase Real-time review subscription
    const channel = supabase
      .channel(`destination-reviews-${destination.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `destination_id=eq.${destination.id}`,
        },
        () => fetchReviews()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [destination.id]);

  const handleSubmitReview = async () => {
    if (!reviewerName.trim()) {
      Alert.alert('Required Field', 'Please enter your name or nickname.');
      return;
    }
    if (!reviewComment.trim()) {
      Alert.alert('Required Field', 'Please write a brief review.');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('reviews').insert([
        {
          destination_id: destination.id,
          user_name: reviewerName.trim(),
          rating: userRating,
          comment: reviewComment.trim(),
        },
      ]);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      setReviewerName('');
      setReviewComment('');
      setUserRating(5);
      setShowReviewModal(false);
      Alert.alert('Review Posted', 'Thank you for rating this tourist destination!');
      fetchReviews();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Top Image Carousel */}
        <View style={styles.imageHeader}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveImageIndex(slide);
            }}
            scrollEventThrottle={16}
          >
            {imageList.map((imgUri, index) => (
              <Image key={index} source={{ uri: imgUri }} style={styles.headerImage} />
            ))}
          </ScrollView>

          {/* Floating Navigation Controls */}
          <SafeAreaView edges={['top']} style={styles.headerTopBar}>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={onGoBack} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#0f172a" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={() => setIsFavorite(!isFavorite)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? '#e11d48' : '#0f172a'}
              />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Dots Indicator */}
          {imageList.length > 1 && (
            <View style={styles.dotsContainer}>
              {imageList.map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.dot, activeImageIndex === idx && styles.activeDot]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Destination Content Sheet */}
        <View style={styles.detailsCard}>
          <View style={styles.metaTopRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {(destination.category || 'ISLAND & BEACH').toUpperCase()}
              </Text>
            </View>

            {/* Live Calculated Rating Badge */}
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#f59e0b" style={{ marginRight: 4 }} />
              <Text style={styles.ratingBadgeText}>{currentRating.toFixed(1)}</Text>
              <Text style={styles.ratingCountText}>({reviewsCount} reviews)</Text>
            </View>
          </View>

          {/* Title & Location */}
          <Text style={styles.destinationTitle}>{destination.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={14} color="#0284c7" />
            <Text style={styles.locationText}>{locationDisplay}</Text>
          </View>

          {/* 3-Column Quick Info Grid */}
          <View style={styles.infoStatsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="cash-outline" size={18} color="#0284c7" />
              <Text style={styles.statLabel}>Entry / Eco Fee</Text>
              <Text style={styles.statValue}>{feeDisplay}</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="boat-outline" size={18} color="#0284c7" />
              <Text style={styles.statLabel}>Travel Time</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {destination.travel_time || destination.priceNote || '15 mins by boat'}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#0284c7" />
              <Text style={styles.statLabel}>Accreditation</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {destination.lgu_status || 'LGU Registered'}
              </Text>
            </View>
          </View>

          {/* Overview */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>About this Destination</Text>
            <Text style={styles.bodyParagraph}>
              {destination.description ||
                `Explore the pristine natural beauty of ${destination.name}. Located in ${locationDisplay}, this spot offers breathtaking views, clear coastal waters, and certified local eco-tourism experiences managed under Calatrava MDRRMO guidelines.`}
            </Text>
          </View>

          {/* Live Visitor Advisory Banner */}
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <Ionicons name="information-circle" size={18} color="#0284c7" />
              <Text style={styles.advisoryTitle}>Visitor Safety Advisory</Text>
            </View>
            <Text style={styles.advisoryBody}>
              {destination.visitor_advisory ||
                'Please check the live sea condition on your dashboard before chartering local pump boats. Always wear certified life vests and register with local boat operators.'}
            </Text>
          </View>

          {/* Guest Reviews & Feedback Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>Visitor Feedback & Ratings</Text>
                <Text style={styles.reviewsSubHeading}>
                  {reviewsCount === 0
                    ? 'No reviews yet. Share your experience!'
                    : `${currentRating.toFixed(1)} / 5 rating based on ${reviewsCount} reviews`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => setShowReviewModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={15} color="#0284c7" />
                <Text style={styles.writeReviewBtnText}>Rate Spot</Text>
              </TouchableOpacity>
            </View>

            {loadingReviews ? (
              <ActivityIndicator size="small" color="#0284c7" style={{ marginVertical: 20 }} />
            ) : reviews.length === 0 ? (
              <View style={styles.emptyReviewsBox}>
                <Ionicons name="chatbubbles-outline" size={36} color="#94a3b8" />
                <Text style={styles.emptyReviewsText}>No visitor ratings yet.</Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((rev) => (
                  <View key={rev.id} style={styles.reviewItemCard}>
                    <View style={styles.reviewItemHeader}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>
                          {rev.user_name ? rev.user_name[0].toUpperCase() : 'V'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.reviewerName}>{rev.user_name}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(rev.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>

                      {/* Star Display */}
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons
                            key={s}
                            name={s <= rev.rating ? 'star' : 'star-outline'}
                            size={13}
                            color="#f59e0b"
                          />
                        ))}
                      </View>
                    </View>

                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Booking Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.bottomLabel}>Municipal Entry Fee</Text>
          <Text style={styles.bottomPrice}>{feeDisplay}</Text>
        </View>

        <TouchableOpacity
          style={styles.bookNowBtn}
          onPress={() => onBookNow?.(destination)}
          activeOpacity={0.85}
        >
          <Text style={styles.bookNowBtnText}>Book Tour & Permit</Text>
          <Ionicons name="arrow-forward" size={16} color="#ffffff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Interactive Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Rate Destination</Text>
                <Text style={styles.modalSubtitle}>{destination.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Star Selector */}
            <Text style={styles.inputLabel}>YOUR RATING</Text>
            <View style={styles.starPickerRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setUserRating(star)}
                  style={styles.starTouchArea}
                >
                  <Ionicons
                    name={star <= userRating ? 'star' : 'star-outline'}
                    size={32}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Tourist Name */}
            <Text style={styles.inputLabel}>TOURIST / VISITOR NAME</Text>
            <TextInput
              placeholder="e.g. Maria Santos"
              placeholderTextColor="#94a3b8"
              value={reviewerName}
              onChangeText={setReviewerName}
              style={styles.textInput}
            />

            {/* Comments */}
            <Text style={styles.inputLabel}>FEEDBACK & TIPS FOR TRAVELERS</Text>
            <TextInput
              placeholder="Describe the beach, water clarity, boat ride, or guide service..."
              placeholderTextColor="#94a3b8"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={4}
              style={[styles.textInput, styles.textArea]}
            />

            {/* Buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitReviewBtn}
                onPress={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitReviewBtnText}>Post Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  imageHeader: {
    width: width,
    height: 320,
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  headerImage: {
    width: width,
    height: 320,
    resizeMode: 'cover',
  },
  headerTopBar: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeDot: {
    width: 18,
    backgroundColor: '#ffffff',
  },
  detailsCard: {
    marginTop: -24,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  metaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
    marginRight: 4,
  },
  ratingCountText: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '600',
  },
  destinationTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 20,
  },
  locationText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  infoStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 6,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  bodyParagraph: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  advisoryCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 22,
  },
  advisoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  advisoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
  },
  advisoryBody: {
    fontSize: 12,
    color: '#0284c7',
    lineHeight: 18,
  },
  reviewsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 20,
    marginBottom: 10,
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewsSubHeading: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  writeReviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyReviewsBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyReviewsText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    fontWeight: '600',
  },
  reviewsList: {
    gap: 12,
  },
  reviewItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reviewItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  reviewDate: {
    fontSize: 10,
    color: '#94a3b8',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 8,
  },
  priceContainer: {
    flex: 1,
  },
  bottomLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  bottomPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284c7',
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    elevation: 2,
  },
  bookNowBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  starPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 6,
  },
  starTouchArea: {
    padding: 4,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
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
  submitReviewBtn: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitReviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});