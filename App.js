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
// NUEVO: Añadido Modal y Pressable
import { StyleSheet, View, Text, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator, Modal, Pressable } from 'react-native';
import MapView, { Marker, Callout, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';

// Importar la base de datos (db) de tu archivo de configuración
import { db } from './firebaseConfig'; 
// Importar funciones de firestore para consultar
import { collection, getDocs } from 'firebase/firestore'; 

// Importar los íconos personalizados
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

  // --- NUEVO: Estados para el Modal ---
  const [modalVisible, setModalVisible] = React.useState(false);
  // selectedSpot guardará el objeto del marcador presionado (ej. 's', 'p', o 'f')
  const [selectedSpot, setSelectedSpot] = React.useState(null);
  // selectedType nos ayudará a mostrar el formato correcto en el modal
  const [selectedType, setSelectedType] = React.useState(null); // 'food', 'pickup', or 'faculty'


  React.useEffect(() => {
    // ... (onReady y requestLocation no cambian) ...
    const onReady = () => {
      mapRef.current?.animateCamera({ center, zoom: 19.5, heading: 0, pitch: 0 }, { duration: 600 });
    };
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
    
    // ... (fetchAllData no cambia) ...
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const foodQuery = await getDocs(collection(db, "foodSpots"));
        const foodData = foodQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFoodSpots(foodData);
        
        const pickupQuery = await getDocs(collection(db, "pickupPoints"));
        const pickupData = pickupQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPickupPoints(pickupData);

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

  // --- NUEVO: Funciones para el Modal ---
  const openModal = (spot, type) => {
    setSelectedSpot(spot);
    setSelectedType(type);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedSpot(null);
    setSelectedType(null);
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
            image={foodIcon} 
            title={s.name || ''} 
            description={s.desc || ''}
            // MODIFICADO: onPress en lugar de onCalloutPress
            onPress={() => openModal(s, 'food')}
          >
            {/* MODIFICADO: Se elimina el <Callout> */}
          </Marker>
        ))}
        
        {/* --- Capa de Paradas (pickupPoints) --- */}
        {showPickup && pickupPoints.map(p => (
          p.coord && <Marker 
            key={p.id} 
            coordinate={{ latitude: p.coord.latitude, longitude: p.coord.longitude }} 
            image={busIcon} 
            title={p.name || ''} 
            description={p.lines || ''}
            // MODIFICADO: onPress en lugar de onCalloutPress
            onPress={() => openModal(p, 'pickup')}
          >
            {/* MODIFICADO: Se elimina el <Callout> */}
          </Marker>
        ))}

        {/* --- Capa de Facultades (faculties) --- */}
        {showFaculties && faculties.map(f => (
          f.coord && <Marker 
            key={f.id} 
            coordinate={{ latitude: f.coord.latitude, longitude: f.coord.longitude }} 
            image={facultyIcon} 
            title={f.name || ''} 
            description={f.desc || ''}
            // MODIFICADO: onPress en lugar de onCalloutPress
            onPress={() => openModal(f, 'faculty')}
          >
            {/* MODIFICADO: Se elimina el <Callout> */}
          </Marker>
        ))}

      </MapView> 

      {/* ... (Indicador de Carga, Controles y Botón de Usuario) ... */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Cargando puntos de interés...</Text>
        </View>
      )}
      <View style={styles.filters}>
        <Chip label={showFood ? 'Comida: ON' : 'Comida: OFF'} onPress={() => setShowFood(v => !v)} />
        <Chip label={showPickup ? 'Paradas: ON' : 'Paradas: OFF'} onPress={() => setShowPickup(v => !v)} />
        <Chip label={showFaculties ? 'Facultades: ON' : 'Facultades: OFF'} onPress={() => setShowFaculties(v => !v)} />
      </View>
      <TouchableOpacity style={styles.userLocationButton} onPress={centerOnUser}>
        <Text style={{ fontWeight: 'bold' }}>🎯</Text>
      </TouchableOpacity>


      {/* --- NUEVO: Modal de Detalles --- */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        {/* Pressable para el fondo oscuro que cierra el modal */}
        <Pressable style={styles.modalBackground} onPress={closeModal}>
          {/* Pressable para el contenido, para evitar que el clic se propague al fondo */}
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {selectedSpot && (
              <>
                <Text style={styles.modalTitle}>{selectedSpot.name}</Text>
                
                {/* Lógica para mostrar 'desc' o 'lines' */}
                {selectedType === 'pickup' ? (
                  <Text style={styles.modalDesc}>Líneas: {selectedSpot.lines || 'No especificadas'}</Text>
                ) : (
                  <Text style={styles.modalDesc}>{selectedSpot.desc || 'No hay descripción disponible.'}</Text>
                )}

                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={() => {
                    openExternalNav(selectedSpot.coord.latitude, selectedSpot.coord.longitude, selectedSpot.name);
                    closeModal(); // Opcional: cerrar el modal después de presionar
                  }}
                >
                  <Text style={styles.modalButtonText}>Ir con Maps</Text>
                </TouchableOpacity>

                {/* Botón para cerrar (alternativo) */}
                <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                  <Text style={styles.closeButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      
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
  },

  // --- NUEVO: Estilos del Modal ---
  modalBackground: {
    flex: 1,
    justifyContent: 'flex-end', // Alinea el contenido al fondo
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fondo oscuro semitransparente
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 22,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#007AFF', // Azul de Apple
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  }
});