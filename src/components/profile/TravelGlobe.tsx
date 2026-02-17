import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface City {
  name: string;
  lat: number;
  lng: number;
  country?: string;
}

interface TravelGlobeProps {
  cities: City[];
  size?: number;
}

export function TravelGlobe({ cities, size = 280 }: TravelGlobeProps) {
  const htmlContent = useMemo(() => {
    const citiesJson = JSON.stringify(cities);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: transparent;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    #globe {
      width: 100%;
      height: 100%;
    }
  </style>
  <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
  <script src="https://unpkg.com/globe.gl@2.27.1/dist/globe.gl.min.js"></script>
</head>
<body>
  <div id="globe"></div>
  <script>
    const cities = ${citiesJson};

    // Create points data for cities
    const pointsData = cities.map(city => ({
      lat: city.lat,
      lng: city.lng,
      name: city.name,
      size: 0.5,
      color: '#FF6B35'
    }));

    // Create arcs between cities if more than 1
    const arcsData = [];
    if (cities.length > 1) {
      for (let i = 0; i < cities.length - 1; i++) {
        arcsData.push({
          startLat: cities[i].lat,
          startLng: cities[i].lng,
          endLat: cities[i + 1].lat,
          endLng: cities[i + 1].lng,
          color: ['#FF6B35', '#FFB347']
        });
      }
    }

    const globe = Globe()
      .globeImageUrl('https://unpkg.com/three-globe@2.27.1/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe@2.27.1/example/img/earth-topology.png')
      .backgroundImageUrl('')
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#4ECDC4')
      .atmosphereAltitude(0.15)
      .pointsData(pointsData)
      .pointAltitude(0.01)
      .pointRadius('size')
      .pointColor('color')
      .pointsMerge(true)
      .arcsData(arcsData)
      .arcColor('color')
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(1500)
      .arcStroke(0.5)
      (document.getElementById('globe'));

    // Set initial position and auto-rotate
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.5;
    globe.controls().enableZoom = false;

    // Point of view - center on first city or default
    if (cities.length > 0) {
      globe.pointOfView({ lat: cities[0].lat, lng: cities[0].lng, altitude: 2.5 }, 1000);
    } else {
      globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });
    }

    // Resize handler
    window.addEventListener('resize', () => {
      globe.width(window.innerWidth);
      globe.height(window.innerHeight);
    });
  </script>
</body>
</html>
    `;
  }, [cities]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 140,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
