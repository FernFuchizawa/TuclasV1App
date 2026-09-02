import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import TransportationScreen from './src/screens/TransportationScreen';
import HotelsScreen from './src/screens/HotelsScreen';
import HotelDetailScreen from './src/screens/HotelDetailScreen';
import FoodScreen from './src/screens/FoodScreen';
import FoodDetailScreen from './src/screens/FoodDetailScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import DestinationDetailScreen from './src/screens/DestinationDetailScreen';
import MapScreen from './src/screens/MapScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import AllDestinationsScreen from './src/screens/AllDestinationsScreen';
import OperatorDashboardScreen from './src/screens/OperatorDashboardScreen';

// Navigation Components
import BottomNavBar from './src/components/BottomNavBar';

export type AppState =
  | 'splash'
  | 'auth'
  | 'home'
  | 'bookings'
  | 'transportation'
  | 'hotels'
  | 'hotel_detail'
  | 'food'
  | 'food_detail'
  | 'explore'
  | 'destination_detail'
  | 'maps'
  | 'profile'
  | 'notifications'
  | 'all_destinations'
  | 'operator_dashboard';

export default function App() {
  const [appState, setAppState] = useState<AppState>('splash');
  const [userRole, setUserRole] = useState<'tourist' | 'operator' | 'admin'>('tourist');
  const [operatorDetails, setOperatorDetails] = useState<{ id?: string; name?: string }>({});

  // Selection States
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [selectedHotel, setSelectedHotel] = useState<any>(null);
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [previousScreen, setPreviousScreen] = useState<AppState>('home');

  // Location Geolocation States
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Calatrava, Romblon');
  const [distanceSubtext, setDistanceSubtext] = useState('Find your next adventure...');

  // Check Supabase Profile & User Metadata Role on Login
  const resolveUserProfile = async (user: any) => {
    try {
      // 1. Instant check from auth user_metadata (eliminates sign-up race conditions)
      const metaRole = user?.user_metadata?.role;

      // 2. Fetch database profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, operator_id, operators ( name )')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.log('Profile resolution error:', error.message);
      }

      const resolvedRole = profile?.role || metaRole || 'tourist';

      if (resolvedRole === 'operator') {
        setUserRole('operator');
        setOperatorDetails({
          id: profile?.operator_id,
          name:
            (profile as any)?.operators?.name ||
            user?.user_metadata?.full_name ||
            'Calatrava Operator Desk',
        });
        setAppState('operator_dashboard');
        return;
      }

      setUserRole('tourist');
      setAppState('home');
    } catch (err) {
      console.log('Role check error:', err);
      if (user?.user_metadata?.role === 'operator') {
        setUserRole('operator');
        setAppState('operator_dashboard');
      } else {
        setUserRole('tourist');
        setAppState('home');
      }
    }
  };

  useEffect(() => {
    // Initial Session Check
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await resolveUserProfile(session.user);
      } else {
        setTimeout(() => {
          setAppState('auth');
        }, 2200);
      }
    };

    checkInitialSession();

    // Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        await resolveUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUserRole('tourist');
        setOperatorDetails({});
        setAppState('auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handlers for dynamic navigation
  const handleSelectDestination = (dest: any, source: AppState) => {
    setSelectedDestination(dest);
    setPreviousScreen(source);
    setAppState('destination_detail');
  };

  const handleSelectHotel = (hotel: any) => {
    setSelectedHotel(hotel);
    setAppState('hotel_detail');
  };

  const handleSelectFood = (food: any) => {
    setSelectedFood(food);
    setAppState('food_detail');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserRole('tourist');
    setAppState('auth');
  };

  // Determine if bottom navigation bar should be visible
  const isMainTab =
    ['home', 'bookings', 'maps', 'profile'].includes(appState) &&
    userRole !== 'operator';

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {/* 1. Splash Screen */}
        {appState === 'splash' && <SplashScreen />}

        {/* 2. Authentication Screen */}
        {appState === 'auth' && (
          <AuthScreen
            onSuccess={() => {
              supabase.auth.getUser().then(({ data }) => {
                if (data.user) resolveUserProfile(data.user);
              });
            }}
            onLoginSuccess={() => {
              supabase.auth.getUser().then(({ data }) => {
                if (data.user) resolveUserProfile(data.user);
              });
            }}
          />
        )}

        {/* 3. Operator Mode Desk */}
        {appState === 'operator_dashboard' && userRole === 'operator' && (
          <OperatorDashboardScreen
            operatorId={operatorDetails.id}
            operatorName={operatorDetails.name}
            onLogout={handleLogout}
          />
        )}

        {/* 4. Tourist Home Dashboard */}
        {appState === 'home' && (
          <HomeScreen
            onNavigateTab={(tab: string) => {
              if (tab === 'activities') {
                setAppState('explore');
              } else {
                setAppState(tab as AppState);
              }
            }}
            onSelectDestination={(dest) => handleSelectDestination(dest, 'home')}
            locationLabel={locationLabel}
            distanceSubtext={distanceSubtext}
            onLocationDetailsUpdated={(label, subtext, coords) => {
              setLocationLabel(label);
              setDistanceSubtext(subtext);
              setUserLocation(coords);
            }}
            onLocationUpdated={(coords) => setUserLocation(coords)}
          />
        )}

        {/* 5. All Destinations Grid */}
        {appState === 'all_destinations' && (
          <AllDestinationsScreen
            onBack={() => setAppState('home')}
            onSelectDestination={(dest) => handleSelectDestination(dest, 'all_destinations')}
          />
        )}

        {/* 6. Destination / Tour Detail Screen */}
        {appState === 'destination_detail' && (
          <DestinationDetailScreen
            destination={selectedDestination}
            onGoBack={() => setAppState(previousScreen)}
            onBookNow={() => setAppState('bookings')}
          />
        )}

        {/* 7. Hotels & Stays Feed */}
        {appState === 'hotels' && (
          <HotelsScreen
            onGoBack={() => setAppState('home')}
            onNavigateTab={(tab: string) => setAppState(tab as AppState)}
            onNavigateToMap={() => setAppState('maps')}
            onSelectHotel={handleSelectHotel}
          />
        )}

        {/* 8. Hotel Detail Screen */}
        {appState === 'hotel_detail' && (
          <HotelDetailScreen
            hotel={selectedHotel}
            onGoBack={() => setAppState('hotels')}
          />
        )}

        {/* 9. Food & Dining Feed */}
        {appState === 'food' && (
          <FoodScreen
            onGoBack={() => setAppState('home')}
            onNavigateTab={(tab: string) => setAppState(tab as AppState)}
            onSelectFood={handleSelectFood}
          />
        )}

        {/* 10. Food Detail Screen */}
        {appState === 'food_detail' && (
          <FoodDetailScreen
            food={selectedFood}
            onGoBack={() => setAppState('food')}
          />
        )}

        {/* 11. Unified Explore & Activities Screen */}
        {appState === 'explore' && (
          <ExploreScreen
            onGoBack={() => setAppState('home')}
            onNavigateTab={(tab: string) => setAppState(tab as AppState)}
            onSelectDestination={(item) => handleSelectDestination(item, 'explore')}
          />
        )}

        {/* 12. Bookings Management Screen */}
        {appState === 'bookings' && (
          <BookingsScreen onNavigateTab={(tab: string) => setAppState(tab as AppState)} />
        )}

        {/* 13. Transportation Matrix Screen */}
        {appState === 'transportation' && (
          <TransportationScreen onGoBack={() => setAppState('home')} />
        )}

        {/* 14. Interactive Map */}
        {appState === 'maps' && (
          <MapScreen
            userLocation={userLocation}
            onGoBack={() => setAppState('home')}
            onNavigateTab={(tab: string) => setAppState(tab as AppState)}
            onSelectDestination={(item: any) => {
              const cat = (item.category || item.rawCategory || '').toLowerCase();
              if (
                cat.includes('accommodation') ||
                cat.includes('hotel') ||
                cat.includes('stay') ||
                cat.includes('resort') ||
                cat.includes('inn')
              ) {
                handleSelectHotel(item);
              } else if (
                cat.includes('food') ||
                cat.includes('dining') ||
                cat.includes('restaurant') ||
                cat.includes('cafe')
              ) {
                handleSelectFood(item);
              } else {
                handleSelectDestination(item, 'maps');
              }
            }}
          />
        )}

        {/* 15. User Profile Screen */}
        {appState === 'profile' && (
          <ProfileScreen
            onLogout={handleLogout}
            onNavigateTab={(tab: string) => setAppState(tab as AppState)}
          />
        )}

        {/* 16. Notifications Screen */}
        {appState === 'notifications' && (
          <NotificationScreen
            onGoBack={() => setAppState('home')}
            onNavigateTab={(tab: string) => setAppState(tab as AppState)}
          />
        )}

        {/* Persistent Bottom Bar for Main Tabs */}
        {isMainTab && (
          <BottomNavBar
            activeTab={appState as 'home' | 'bookings' | 'maps' | 'profile'}
            onNavigateTab={(tab) => setAppState(tab as AppState)}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
});