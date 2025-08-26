export function decodePolyline(encoded: string): { latitude: number, longitude: number }[] {
  let poly: { latitude: number, longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
} 

// Encode an array of { latitude, longitude } to a polyline string array
export function encodePolyline(coordinates: { latitude: number, longitude: number }[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = '';

  for (const point of coordinates) {
    let lat = Math.round(point.latitude * 1e5);
    let lng = Math.round(point.longitude * 1e5);
    let dLat = lat - lastLat;
    let dLng = lng - lastLng;
    result += encodeSignedNumber(dLat) + encodeSignedNumber(dLng);
    lastLat = lat;
    lastLng = lng;
  }
  return result;
}

function encodeSignedNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) {
    sgnNum = ~sgnNum;
  }
  return encodeNumber(sgnNum);
}

function encodeNumber(num: number): string {
  let encodeString = '';
  while (num >= 0x20) {
    encodeString += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  encodeString += String.fromCharCode(num + 63);
  return encodeString;
} 