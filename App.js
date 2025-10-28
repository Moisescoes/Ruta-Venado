import * as React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import MapView, { Marker, Callout, Polyline, UrlTile } from 'react-native-maps';

export default function App() {
  const mapRef = React.useRef(null);
  const center = { latitude: 18.9816298, longitude: -99.2381597 };

  const foodSpots = [
    { id: 'f1', name: 'Tacos El Patio', coords: { latitude: 18.98195, longitude: -99.23832 }, desc: 'Tacos y tortas' },
    { id: 'f2', name: 'Cafetería Central', coords: { latitude: 18.98128, longitude: -99.23885 }, desc: 'Café y pan' },
  ];

  const pickupPoints = [
    { id: 'p1', name: 'Parada Norte', coords: { latitude: 18.98220, longitude: -99.23795 }, lines: 'Ruta A / C' },
    { id: 'p2', name: 'Parada Sur', coords: { latitude: 18.98110, longitude: -99.23940 }, lines: 'Ruta B' },
  ];

  const routePath = [
    { latitude: 18.98220, longitude: -99.23795 },
    { latitude: 18.98180, longitude: -99.23840 },
    { latitude: 18.98140, longitude: -99.23890 },
    { latitude: 18.98110, longitude: -99.23940 },
  ];

  const [showFood, setShowFood] = React.useState(true);
  const [showPickup, setShowPickup] = React.useState(true);
  const [showRoute, setShowRoute] = React.useState(true);

  React.useEffect(() => {
    const onReady = () => {
      mapRef.current?.animateCamera({ center, zoom: 19.5, heading: 0, pitch: 0 }, { duration: 600 });
    };
    requestAnimationFrame(onReady);
  }, []);

  const openExternalNav = (lat, lng, label = 'Destino') => {
    const scheme = Platform.select({ ios: 'http://maps.apple.com/', android: 'geo:' });
    if (Platform.OS === 'ios') {
      Linking.openURL(`${scheme}?ll=${lat},${lng}&q=${encodeURIComponent(label)}`);
    } else {
      const url = `google.navigation:q=${lat},${lng}`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`${scheme}${lat},${lng}?q=${encodeURIComponent(label)}`);
      });
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={(r) => { mapRef.current = r; }}
        style={styles.map}
        mapType="none"
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* ✅ Capa de MapTiler con tu API key */}
        <UrlTile
          urlTemplate="https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=Uhmy6q3KUCQAb59oD9g7"
          maximumZ={20}
          zIndex={-1}
        />

        {/* Marcador del edificio/centro */}
        <Marker coordinate={center} title="Edificio objetivo" description="Punto central" />

        {/* Lugares de comida */}
        {showFood && foodSpots.map(s => (
          <Marker key={s.id} coordinate={s.coords} pinColor="orange" title={s.name} description={s.desc}>
            <Callout onPress={() => openExternalNav(s.coords.latitude, s.coords.longitude, s.name)}>
              <View style={{ maxWidth: 220 }}>
                <Text style={{ fontWeight: '600' }}>{s.name}</Text>
                <Text>{s.desc}</Text>
                <Text style={{ marginTop: 6, textDecorationLine: 'underline' }}>Ir con Maps</Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Puntos de abordaje */}
        {showPickup && pickupPoints.map(p => (
          <Marker key={p.id} coordinate={p.coords} pinColor="blue" title={p.name} description={p.lines}>
            <Callout onPress={() => openExternalNav(p.coords.latitude, p.coords.longitude, p.name)}>
              <View style={{ maxWidth: 220 }}>
                <Text style={{ fontWeight: '600' }}>{p.name}</Text>
                <Text>Lineas: {p.lines}</Text>
                <Text style={{ marginTop: 6, textDecorationLine: 'underline' }}>Navegar aquí</Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Ruta */}
        {showRoute && <Polyline coordinates={routePath} strokeWidth={4} />}
      </MapView>

      {/* Controles */}
      <View style={styles.filters}>
        <Chip label={showFood ? 'Comida: ON' : 'Comida: OFF'} onPress={() => setShowFood(v => !v)} />
        <Chip label={showPickup ? 'Paradas: ON' : 'Paradas: OFF'} onPress={() => setShowPickup(v => !v)} />
        <Chip label={showRoute ? 'Ruta: ON' : 'Ruta: OFF'} onPress={() => setShowRoute(v => !v)} />
      </View>
    </View>
  );
}

const Chip = ({ label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.chip}>
    <Text style={{ fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: '100%', height: '100%' },
  filters: {
    position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, padding: 8,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#eee', marginHorizontal: 4 },
});



