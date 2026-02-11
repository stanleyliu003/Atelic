import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Auth, API } from 'aws-amplify';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import * as customQueries from '../src/graphql/customQueries';
import * as customMutations from '../src/graphql/customMutations';
import { getUserProfile } from '../src/graphql/queries';
import * as ImagePicker from 'expo-image-picker';

const DEFAULT_AVATAR = require('../assets/images/default-avatar.png');

export default function EditProfileScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const userName = user.attributes?.preferred_username || '';
      const name = user.attributes?.name || '';

      setUsername(userName);
      setFullName(name);

      // Load bio and profile photo from UserProfilesStorage
      const response = await API.graphql({
        query: getUserProfile,
        variables: { username: userName },
      });

      const profile = response.data.getUserProfile;
      if (profile) {
        setBio(profile.bio || '');
        setProfilePhotoUrl(profile.profilePhotoUrl || null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }

    setIsSaving(true);

    try {
      // Update Cognito user attributes
      const user = await Auth.currentAuthenticatedUser();
      await Auth.updateUserAttributes(user, {
        name: fullName.trim(),
      });

      // Update bio and profile photo in UserProfilesStorage
      await API.graphql({
        query: customMutations.updateUserProfile,
        variables: {
          username: username,
          action: 'UPDATE_PROFILE_INFO',
          tripData: JSON.stringify({
            bio: bio.trim() || null,
            profilePhotoUrl: profilePhotoUrl || null,
          }),
        },
      });

      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const requestPermission = async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const uploadImageToHost = async (imageUri) => {
    try {
      // Upload to free image host (0x0.st)
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';

      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: 'image/jpeg',
      });

      const response = await fetch('https://0x0.st', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const imageUrl = await response.text();
      return imageUrl.trim();
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  const pickImage = async (source) => {
    try {
      const hasPermission = await requestPermission(source);
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          `Please allow access to your ${source === 'camera' ? 'camera' : 'photo library'} in Settings.`
        );
        return;
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        try {
          // Upload image to hosting service
          const imageUrl = await uploadImageToHost(result.assets[0].uri);
          setProfilePhotoUrl(imageUrl);
        } catch (error) {
          console.error('Image upload error:', error);
          Alert.alert('Upload Failed', 'Failed to upload photo. Please try again.');
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleChangePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImage('camera');
          } else if (buttonIndex === 2) {
            pickImage('library');
          } else if (buttonIndex === 3) {
            setProfilePhotoUrl(null);
          }
        }
      );
    } else {
      Alert.alert(
        'Change Photo',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: () => pickImage('camera') },
          { text: 'Choose from Library', onPress: () => pickImage('library') },
          { text: 'Remove Photo', onPress: () => setProfilePhotoUrl(null), style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.ORANGE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.BLACK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.ORANGE} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Photo */}
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={handleChangePhoto} disabled={isUploadingPhoto}>
              <View style={styles.photoWrapper}>
                <Image
                  source={profilePhotoUrl ? { uri: profilePhotoUrl } : DEFAULT_AVATAR}
                  style={styles.profilePhoto}
                  defaultSource={DEFAULT_AVATAR}
                />
                {isUploadingPhoto ? (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator size="large" color={Colors.WHITE} />
                  </View>
                ) : (
                  <View style={styles.cameraIconContainer}>
                    <Ionicons name="camera" size={18} color={Colors.WHITE} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handleChangePhoto}
              disabled={isUploadingPhoto}
            >
              <Text style={styles.changePhotoText}>
                {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Username (Read-only) */}
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View style={[styles.input, styles.disabledInput]}>
                <Text style={styles.disabledText}>@{username}</Text>
              </View>
              <Text style={styles.hint}>Username cannot be changed</Text>
            </View>

            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.GRAY}
                style={styles.input}
                maxLength={50}
              />
              <Text style={styles.charCount}>{fullName.length}/50</Text>
            </View>

            {/* Bio */}
            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor={Colors.GRAY}
                style={[styles.input, styles.bioInput]}
                multiline
                numberOfLines={4}
                maxLength={150}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{bio.length}/150</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.BLACK,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ORANGE,
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
  },
  photoWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.WHITE,
  },
  changePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ORANGE,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.BLACK,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.LIGHT_GRAY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.BLACK,
    backgroundColor: Colors.WHITE,
  },
  bioInput: {
    height: 100,
    paddingTop: 12,
  },
  disabledInput: {
    backgroundColor: Colors.LIGHT_GRAY,
  },
  disabledText: {
    fontSize: 16,
    color: Colors.GRAY,
  },
  hint: {
    fontSize: 12,
    color: Colors.GRAY,
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: Colors.GRAY,
    textAlign: 'right',
    marginTop: 4,
  },
});
