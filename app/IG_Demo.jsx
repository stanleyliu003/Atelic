import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function IGDemo() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(9);

  // Video refs for demo pages
  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);
  const videoRef3 = useRef(null);
  const videoRef3_5 = useRef(null);
  const videoRef4 = useRef(null);

  const handleNextPress = () => {
    // Go to next page
    setCurrentPage(currentPage + 1);
  };

  return (
    <View style={styles.container}>
      {/* Page 9: Fullscreen Demo Video 1 */}
      {currentPage === 9 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef1}
            source={require('../assets/Demo_S1.mp4')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton1, styles.demoButtonPosition1]}
            onPress={handleNextPress}
          />
        </View>
      )}

      {/* Page 10: Fullscreen Demo Video 2 */}
      {currentPage === 10 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef2}
            source={require('../assets/Demo_S2.mp4')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton1, styles.demoButtonPosition2]}
            onPress={handleNextPress}
          />
        </View>
      )}

      {/* Page 11: Fullscreen Demo Video 3 */}
      {currentPage === 11 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef3}
            source={require('../assets/Demo_S3.mp4')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton1, styles.demoButtonPosition3]}
            onPress={handleNextPress}
          />
        </View>
      )}

      {/* Page 12: Fullscreen Demo Video 3.5 */}
      {currentPage === 12 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef3_5}
            source={require('../assets/Demo_S3.5.mov')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton2, styles.demoButtonPosition3_5]}
            onPress={handleNextPress}
          />
        </View>
      )}

      {/* Page 13: Fullscreen Demo Video 4 - auto advance when finished */}
      {currentPage === 13 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef4}
            source={require('../assets/Demo_S4.mov')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={false}
            isMuted={true}
            useNativeControls={false}
            onPlaybackStatusUpdate={(status) => {
              if (status.didJustFinish) {
                // After page 13 video finishes, go back to saved_places
                router.replace({
                  pathname: '/(tabs)/saved_places',
                  params: { skipOnboarding: 'true' }
                });
              }
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideo: {
    width: screenWidth,
    height: screenHeight,
  },
  demoButton1: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
  },
  demoButton2: {
    position: 'absolute',
    width: 240,
    height: 80,
    backgroundColor: 'transparent',
  },
  demoButtonPosition1: {
    bottom: screenHeight * 0.20,
    right: 0,
  },
  demoButtonPosition2: {
    bottom: screenHeight * 0.106,
    left: (screenWidth - 80) / 2,
  },
  demoButtonPosition3: {
    bottom: screenHeight * 0.153,
    left: (screenWidth - 175) / 2,
  },
  demoButtonPosition3_5: {
    bottom: screenHeight * 0.15,
    left: (screenWidth - 240) / 2,
  },
});
