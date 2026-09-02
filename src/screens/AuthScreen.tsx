import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  onSuccess?: () => void;
  onLoginSuccess?: () => void;
}

const STORAGE_EMAIL_KEY = '@tuclas_saved_email';
const STORAGE_REMEMBER_KEY = '@tuclas_remember_me';

export default function AuthScreen({ onSuccess, onLoginSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Role Selection (Tourist vs Operator)
  const [role, setRole] = useState<'tourist' | 'operator'>('tourist');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(STORAGE_EMAIL_KEY);
        const rememberStatus = await AsyncStorage.getItem(STORAGE_REMEMBER_KEY);

        if (rememberStatus === 'true' && savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (err) {
        console.log('Error reading remember me storage:', err);
      }
    };

    loadRememberedEmail();
  }, []);

  const handleNavigationSuccess = () => {
    if (onLoginSuccess) onLoginSuccess();
    if (onSuccess) onSuccess();
  };

  const handleAuth = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    if (isSignUp) {
      if (!fullName.trim()) {
        Alert.alert('Required Fields', 'Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match.');
        return;
      }
      if (!agreeTerms) {
        Alert.alert('Terms & Privacy', 'Please agree to the Terms & Privacy Policy.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const phoneFormatted = mobileNumber.trim() ? `+63${mobileNumber.trim()}` : null;

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: fullName.trim(),
              phone_number: phoneFormatted,
              role: role,
            },
          },
        });

        if (error) {
          Alert.alert('Sign Up Failed', error.message);
          return;
        }

        // Upsert into profiles table to synchronize role immediately
        if (data?.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName.trim(),
            phone_number: phoneFormatted,
            role: role,
          });
        }

        if (data?.session) {
          handleNavigationSuccess();
        } else {
          Alert.alert(
            'Account Created',
            role === 'operator'
              ? 'Operator account registered successfully! You can now sign in.'
              : 'Tourist account created! You can now sign in.'
          );
          setIsSignUp(false);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          Alert.alert('Sign In Failed', error.message);
          return;
        }

        // Save or clear Remember Me credentials
        if (rememberMe) {
          await AsyncStorage.setItem(STORAGE_EMAIL_KEY, cleanEmail);
          await AsyncStorage.setItem(STORAGE_REMEMBER_KEY, 'true');
        } else {
          await AsyncStorage.removeItem(STORAGE_EMAIL_KEY);
          await AsyncStorage.setItem(STORAGE_REMEMBER_KEY, 'false');
        }

        if (data?.session || data?.user) {
          handleNavigationSuccess();
        } else {
          Alert.alert('Notice', 'No active session found.');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Authentication request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      Alert.alert(
        'Forgot Password',
        'Please enter your registered email in the Email field above first.'
      );
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send a password reset link to ${cleanEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
              if (error) {
                Alert.alert('Reset Failed', error.message);
              } else {
                Alert.alert(
                  'Check Your Inbox',
                  `A password reset link has been sent to ${cleanEmail}. Check your email to create a new password.`
                );
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Unable to send reset email.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={['#ffffff', '#f4f9ff', '#dff0ff', '#cfe8ff']}
      locations={[0, 0.35, 0.75, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isSignUp ? styles.signUpScroll : styles.loginScroll,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isSignUp ? 'Create your Account' : 'Login your Account'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp
                ? "Start your journey through Calatrava's finest spots."
                : 'Welcome Back to Calatrava'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {isSignUp ? (
              <>
                {/* Account Role Selector */}
                <View style={styles.roleContainer}>
                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'tourist' && styles.roleBtnActive]}
                    onPress={() => setRole('tourist')}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name="user"
                      size={15}
                      color={role === 'tourist' ? '#ffffff' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.roleBtnText,
                        role === 'tourist' && styles.roleBtnTextActive,
                      ]}
                    >
                      Tourist
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'operator' && styles.roleBtnActive]}
                    onPress={() => setRole('operator')}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name="anchor"
                      size={15}
                      color={role === 'operator' ? '#ffffff' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.roleBtnText,
                        role === 'operator' && styles.roleBtnTextActive,
                      ]}
                    >
                      Operator (Boat / TODA)
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputBox}>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={role === 'operator' ? 'Operator / Captain Full Name' : 'Full Name'}
                    placeholderTextColor="#64748b"
                    style={styles.input}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputBox}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email Address"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                {/* Mobile Number */}
                <View style={[styles.inputBox, styles.phoneBox]}>
                  <Text style={styles.countryCode}>+63</Text>
                  <View style={styles.divider} />
                  <TextInput
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    placeholder="Mobile Number"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    style={[styles.input, { flex: 1 }]}
                  />
                </View>

                {/* Password */}
                <View style={[styles.inputBox, styles.passwordBox]}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm Password */}
                <View style={[styles.inputBox, styles.passwordBox]}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showConfirmPassword}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                  >
                    <Feather
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>

                {/* Terms */}
                <TouchableOpacity
                  onPress={() => setAgreeTerms(!agreeTerms)}
                  style={styles.termsRow}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
                    {agreeTerms && <Feather name="check" size={11} color="#0099ff" />}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the <Text style={styles.termsBold}>Terms & Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputBox}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.inputBox, styles.passwordBox]}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>

                {/* Remember Me & Forgot Password */}
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    onPress={() => setRememberMe(!rememberMe)}
                    style={styles.rememberGroup}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                      {rememberMe && <Feather name="check" size={11} color="#0099ff" />}
                    </View>
                    <Text style={styles.optionsText}>Remember me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleForgotPassword}
                  >
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Action Button */}
            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              style={[styles.btn, loading && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.btnText}>
                  {isSignUp ? (role === 'operator' ? 'Register as Operator' : 'Sign Up') : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsSignUp(!isSignUp);
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.toggleLink}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Pinned Bottom Footer */}
        <View style={styles.fixedFooter} pointerEvents="none">
          <Text style={styles.footerText}>Calatrava, Romblon Tourism</Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  loginScroll: {
    paddingTop: 110,
  },
  signUpScroll: {
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1b3b6f',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    padding: 4,
    marginBottom: 14,
    gap: 6,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  roleBtnActive: {
    backgroundColor: '#0284c7',
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  roleBtnTextActive: {
    color: '#ffffff',
  },
  inputBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    height: 52,
    marginBottom: 14,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  input: {
    fontSize: 14,
    color: '#1e293b',
  },
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCode: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#94a3b8',
    marginHorizontal: 12,
  },
  passwordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyeBtn: {
    padding: 6,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 18,
  },
  termsText: {
    fontSize: 12,
    color: '#64748b',
  },
  termsBold: {
    color: '#1b3b6f',
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 26,
    paddingHorizontal: 2,
  },
  rememberGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionsText: {
    fontSize: 12,
    color: '#64748b',
  },
  forgotText: {
    fontSize: 12,
    color: '#1b3b6f',
    fontWeight: '600',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxActive: {
    borderColor: '#00a6ff',
    backgroundColor: '#e0f2fe',
  },
  btn: {
    backgroundColor: '#00a6ff',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00a6ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  toggleText: {
    fontSize: 13,
    color: '#64748b',
  },
  toggleLink: {
    fontSize: 13,
    color: '#1b3b6f',
    fontWeight: '700',
  },
  fixedFooter: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#0099ff',
    letterSpacing: 0.5,
  },
});