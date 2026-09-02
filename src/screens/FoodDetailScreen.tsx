import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

interface ReviewItem {
  id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface FoodDetailProps {
  food: any;
  onGoBack: () => void;
}

export default function FoodDetailScreen({ food, onGoBack }: FoodDetailProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Live Ratings & Reviews State
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [currentRating, setCurrentRating] = useState<number>(food?.rating || 5.0);
  const [reviewsCount, setReviewsCount] = useState<number>(food?.reviews_count || 0);

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!food) return null;

  const imageList: string[] =
    food.images && food.images.length > 0
      ? food.images
      : food.image_url
      ? [food.image_url]
      : ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80'];

  const locationDisplay = food.barangay
    ? `Brgy. ${food.barangay}, Calatrava, Romblon`
    : 'Calatrava, Romblon';

  const contactNumber = food.contact_number || '+639123456789';

  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('destination_id', food.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching dining reviews:', error.message);
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
      console.log('Food review fetch error:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchReviews();

    const channel = supabase
      .channel(`food-reviews-${food.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `destination_id=eq.${food.id}`,
        },
        () => fetchReviews()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [food.id]);

  const handleSubmitReview = async () => {
    if (!reviewerName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (!reviewComment.trim()) {
      Alert.alert('Required', 'Please enter your food review or experience.');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('reviews').insert([
        {
          destination_id: food.id,
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
      Alert.alert('Review Submitted', 'Thank you for reviewing this food spot!');
      fetchReviews();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCall = () => {
    Linking.openURL(`tel:${contactNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call on this device.');
    });
  };

  const handleSMS = () => {
    const text = `Good day! I'd like to inquire about table reservations and specialty dishes at ${food.name}.`;
    Linking.openURL(`sms:${contactNumber}?body=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('Error', 'Unable to open SMS app.');
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Image Carousel */}
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

          {/* Header Controls */}
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

        {/* Content Body */}
        <View style={styles.detailsCard}>
          <View style={styles.metaTopRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {(food.category || 'FOOD & DINING').toUpperCase()}
              </Text>
            </View>

            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#f59e0b" style={{ marginRight: 4 }} />
              <Text style={styles.ratingBadgeText}>{currentRating.toFixed(1)}</Text>
              <Text style={styles.ratingCountText}>({reviewsCount} reviews)</Text>
            </View>
          </View>

          <Text style={styles.foodTitle}>{food.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={14} color="#0284c7" />
            <Text style={styles.locationText}>{locationDisplay}</Text>
          </View>

          {/* 3-Box Dining Stats */}
          <View style={styles.infoStatsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="pricetag-outline" size={18} color="#0284c7" />
              <Text style={styles.statLabel}>Avg Price / Meal</Text>
              <Text style={styles.statValue}>
                {food.eco_fee ? `₱${Number(food.eco_fee).toLocaleString()}` : 'Budget'}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="time-outline" size={18} color="#0284c7" />
              <Text style={styles.statLabel}>Opening Hours</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {food.travel_time || '7 AM - 8 PM'}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#0284c7" />
              <Text style={styles.statLabel}>Status</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {food.lgu_status || 'Sanitary Verified'}
              </Text>
            </View>
          </View>

          {/* About & Specialties */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>About & Kitchen Specialties</Text>
            <Text style={styles.bodyParagraph}>
              {food.description ||
                `${food.name} is a verified dining spot in ${locationDisplay}. Contact them directly to ask about daily seafood catch, advance group orders, and specialty delicacies.`}
            </Text>
          </View>

          {/* Dining Advisory / Policy */}
          {food.visitor_advisory ? (
            <View style={styles.advisoryCard}>
              <View style={styles.advisoryHeader}>
                <Ionicons name="information-circle" size={18} color="#0284c7" />
                <Text style={styles.advisoryTitle}>Dining & Pre-Order Advisory</Text>
              </View>
              <Text style={styles.advisoryBody}>{food.visitor_advisory}</Text>
            </View>
          ) : null}

          {/* Contact Details Card */}
          <View style={styles.contactCard}>
            <Text style={styles.contactHeading}>Table Reservation & Food Orders</Text>
            <Text style={styles.contactSub}>
              Call or text to pre-order fresh seafood, check availability, or arrange group bilao meals.
            </Text>
            <View style={styles.phoneDisplayRow}>
              <Ionicons name="call-outline" size={16} color="#0284c7" />
              <Text style={styles.phoneDisplayText}>{contactNumber}</Text>
            </View>
          </View>

          {/* Guest Reviews Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>Diner Reviews & Ratings</Text>
                <Text style={styles.reviewsSubHeading}>
                  {reviewsCount === 0
                    ? 'No reviews yet. Be the first to rate the food!'
                    : `${currentRating.toFixed(1)} / 5 based on ${reviewsCount} reviews`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => setShowReviewModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={15} color="#0284c7" />
                <Text style={styles.writeReviewBtnText}>Rate Food</Text>
              </TouchableOpacity>
            </View>

            {loadingReviews ? (
              <ActivityIndicator size="small" color="#0284c7" style={{ marginVertical: 20 }} />
            ) : reviews.length === 0 ? (
              <View style={styles.emptyReviewsBox}>
                <Ionicons name="restaurant-outline" size={36} color="#94a3b8" />
                <Text style={styles.emptyReviewsText}>No diner ratings yet.</Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((rev) => (
                  <View key={rev.id} style={styles.reviewItemCard}>
                    <View style={styles.reviewItemHeader}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>
                          {rev.user_name ? rev.user_name[0].toUpperCase() : 'D'}
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

      {/* Sticky Bottom Actions */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.bottomLabel}>Average Cost</Text>
          <Text style={styles.bottomPrice}>
            {food.eco_fee ? `₱${Number(food.eco_fee).toLocaleString()}` : 'Budget'}
            <Text style={styles.perMealText}> / meal</Text>
          </Text>
        </View>

        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.smsBtn} onPress={handleSMS} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0284c7" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
            <Ionicons name="call" size={16} color="#ffffff" />
            <Text style={styles.callBtnText}>Call / Reserve</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Review Modal */}
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
                <Text style={styles.modalTitle}>Rate Food & Service</Text>
                <Text style={styles.modalSubtitle}>{food.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

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

            <Text style={styles.inputLabel}>YOUR NAME</Text>
            <TextInput
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#94a3b8"
              value={reviewerName}
              onChangeText={setReviewerName}
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>FOOD FEEDBACK & MUST-TRY RECOMMENDATION</Text>
            <TextInput
              placeholder="Describe favorite dishes, food taste, cleanliness, service..."
              placeholderTextColor="#94a3b8"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={4}
              style={[styles.textInput, styles.textArea]}
            />

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
  foodTitle: {
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
  contactCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  contactHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  contactSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 10,
  },
  phoneDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneDisplayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
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
  perMealText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
  },
  callBtnText: {
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