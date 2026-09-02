import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SplashScreenProps {
  navigation?: any;
}

export default function SplashScreen({ navigation }: SplashScreenProps) {
  useEffect(() => {
    // Navigate after 2.5 seconds if navigation prop is available
    if (navigation) {
      const timer = setTimeout(() => {
        navigation.replace('MainTabs');
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [navigation]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 48,
      }}
    >
      <View />

      <View style={{ alignItems: 'center' }}>
        <Image
          source={require('../../assets/Tuclas_Logo.png')}
          style={{ width: 220, height: 220 }}
          resizeMode="contain"
        />
        <Text
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#075985',
            marginTop: 16,
            letterSpacing: 0.5,
          }}
        >
          Tu<Text style={{ color: '#0284c7' }}>C</Text>las
        </Text>
        <Text
          style={{
            color: '#64748b',
            fontSize: 12,
            letterSpacing: 2,
            fontWeight: '600',
            textTransform: 'uppercase',
            marginTop: 8,
          }}
        >
          Explore. Navigate. Connect.
        </Text>
      </View>

      <View style={{ alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#0284c7" />
        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
          Calatrava, Romblon Tourism
        </Text>
      </View>
    </SafeAreaView>
  );
}