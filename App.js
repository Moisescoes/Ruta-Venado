// NUEVO: Polyfill para btoa y atob que necesita Firebase
import { decode, encode } from 'base-64'

if (!global.btoa) {
    global.btoa = encode;
}

if (!global.atob) {
    global.atob = decode;
}
// ----- Fin del Polyfill -----


// ----- Tu código normal empieza aquí -----
import * as React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';

// Importar la base de datos (db) de tu archivo de configuración
import { db } from './firebaseConfig'; 
// Importar funciones de firestore para consultar
import { collection, getDocs } from 'firebase/firestore'; 

// NUEVO: Importar los íconos personalizados
// Asegúrate de que la ruta coincida con tu estructura de carpetas
const foodIcon = require('./assets/icons/food.png');
const busIcon = require('./assets/icons/bus.png');
const facultyIcon = require('./assets/icons/faculty.png');

export default function App() {
  const mapRef = React.useRef(null);
  const center = { latitude: 18.9816298, longitude: -99.2381597 };

  // --- Estados para los datos ---
  const [foodSpots, setFoodSpots] = React.useState([]);
  const [faculties, setFaculties] = React.useState([]);
  const [pickupPoints, setPickupPoints] = React.useState([]);
  
  // --- Estados para los filtros ---
  const [showFood, setShowFood] = React.useState(true);
  const [showPickup, setShowPickup] = React.useState(true);
  const [showFaculties, setShowFaculties] = React.useState(true);
  
  const [userLocation, setUserLocation] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true); 

  React.useEffect(() => {
    // Función para centrar el mapa al inicio
    const onReady = () => {
      mapRef.current?.animateCamera({ center, zoom: 19.5, heading: 0, pitch: 0 }, { duration: 600 });
    };

    // Función para pedir permisos de ubicación
    const requestLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'No se puede mostrar la ubicación sin permisos.');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
    };
    
    // Función para cargar TODAS las colecciones
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        
        // 1. Cargar Food Spots
        const foodQuery = await getDocs(collection(db, "foodSpots"));
        const foodData = foodQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFoodSpots(foodData);
        
        // 2. Cargar Pickup Points
        const pickupQuery = await getDocs(collection(db, "pickupPoints"));
        const pickupData = pickupQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPickupPoints(pickupData);

        // 3. Cargar Faculties
        const facultyQuery = await getDocs(collection(db, "faculties"));
        const facultyData = facultyQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFaculties(facultyData);

        console.log("Datos cargados!");

      } catch (error) {
        console.error("Error al cargar datos desde Firestore: ", error);
        Alert.alert("Error", "No se pudieron cargar los puntos de interés.");
      } finally {
        setIsLoading(false);
      }
    };

    requestAnimationFrame(onReady);
    requestLocation();
    fetchAllData(); 
  }, []);

  // ... (openExternalNav y centerOnUser no cambian) ...
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

  const centerOnUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
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
        showsUserLocation={true}
        followsUserLocation={false}
      >
        {/* ... (UrlTile y Marcador Central) ... */}
        <UrlTile
          urlTemplate="https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=Uhmy6q3KUCQAb59oD9g7"
          maximumZ={20}
          zIndex={-1}
        />
        <Marker coordinate={center} title="Edificio Principal" description="FCAeI" />
        
        {/* --- Capa de Comida (foodSpots) --- */}
        {showFood && foodSpots.map(s => (
          s.coord && <Marker 
            key={s.id} 
            coordinate={{ latitude: s.coord.latitude, longitude: s.coord.longitude }} 
            image={foodIcon} // MODIFICADO: Se usa el ícono
            title={s.name || ''} 
            description={s.desc || ''}
            onCalloutPress={() => openExternalNav(s.coord.latitude, s.coord.longitude, s.name)}
          >
            {Platform.OS === 'ios' && (
              <Callout>
                <View style={{ maxWidth: 220 }}>
                  {s.name && <Text style={{ fontWeight: '600' }}>{s.name}</Text>}
                  {s.desc && <Text>{s.desc}</Text>}
                  <Text style={{ marginTop: 6, textDecorationLine: 'underline', color: '#007AFF' }}>Ir con Maps</Text>
                </View>
              </Callout>
            )}
          </Marker>
        ))}
        
        {/* --- Capa de Paradas (pickupPoints) --- */}
        {showPickup && pickupPoints.map(p => (
          p.coord && <Marker 
            key={p.id} 
            coordinate={{ latitude: p.coord.latitude, longitude: p.coord.longitude }} 
            image={busIcon} // MODIFICADO: Se usa el ícono
            title={p.name || ''} 
            description={p.lines || ''}
            onCalloutPress={() => openExternalNav(p.coord.latitude, p.coord.longitude, p.name)}
          >
            {Platform.OS === 'ios' && (
              <Callout>
                <View style={{ maxWidth: 220 }}>
                  {p.name && <Text style={{ fontWeight: '600' }}>{p.name}</Text>}
                  {p.lines && <Text>Lineas: {p.lines}</Text>}
                  <Text style={{ marginTop: 6, textDecorationLine: 'underline', color: '#007AFF' }}>Navegar aquí</Text>
                </View>
              </Callout>
            )}
          </Marker>
        ))}

        {/* --- Capa de Facultades (faculties) --- */}
        {showFaculties && faculties.map(f => (
          f.coord && <Marker 
            key={f.id} 
            coordinate={{ latitude: f.coord.latitude, longitude: f.coord.longitude }} 
            image={facultyIcon} // MODIFICADO: Se usa el ícono
            title={f.name || ''} 
            description={f.desc || ''}
            onCalloutPress={() => openExternalNav(f.coord.latitude, f.coord.longitude, f.name)}
          >
            {Platform.OS === 'ios' && (
              <Callout>
                <View style={{ maxWidth: 220 }}>
                  {f.name && <Text style={{ fontWeight: '600' }}>{f.name}</Text>}
                  {f.desc && <Text>{f.desc}</Text>}
                  <Text style={{ marginTop: 6, textDecorationLine: 'underline', color: '#007AFF' }}>Ir al edificio</Text>
                </View>
              </Callout>
            )}
          </Marker>
        ))}

      </MapView> 

      {/* Indicador de Carga */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Cargando puntos de interés...</Text>
        </View>
      )}

      {/* Controles */}
      <View style={styles.filters}>
        <Chip label={showFood ? 'Comida: ON' : 'Comida: OFF'} onPress={() => setShowFood(v => !v)} />
        <Chip label={showPickup ? 'Paradas: ON' : 'Paradas: OFF'} onPress={() => setShowPickup(v => !v)} />
        <Chip label={showFaculties ? 'Facultades: ON' : 'Facultades: OFF'} onPress={() => setShowFaculties(v => !v)} />
      </View>
      
      <TouchableOpacity style={styles.userLocationButton} onPress={centerOnUser}>
        <Text style={{ fontWeight: 'bold' }}>🎯</Text>
      </TouchableOpacity>
    </View>
  );
}

// ... (El componente Chip no cambia) ...
const Chip = ({ label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.chip}>
    <Text style={{ fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: '100%', height: '100%' },
  filters: {
    position: 'absolute', 
    bottom: 20, 
    alignSelf: 'center', 
    flexWrap: 'wrap',
    justifyContent: 'center',
    flexDirection: 'row', 
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)', 
    borderRadius: 20, 
    padding: 8,
    marginHorizontal: 20, 
  },
  chip: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 999, 
    backgroundColor: '#eee', 
    margin: 2, 
  },
  userLocationButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 50,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  }
});