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
import { StyleSheet, View, Text, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator, Modal, Pressable, ScrollView, TextInput } from 'react-native';
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

  // --- Estados para los Modales ---
  const [detailModalVisible, setDetailModalVisible] = React.useState(false); // Renombrado para claridad
  const [filterModalVisible, setFilterModalVisible] = React.useState(false); // NUEVO
  const [selectedSpot, setSelectedSpot] = React.useState(null);
  const [selectedType, setSelectedType] = React.useState(null); 

  // --- Estado para la Búsqueda ---
  const [searchText, setSearchText] = React.useState('');


  React.useEffect(() => {
    // ... (onReady, requestLocation, fetchAllData no cambian) ...
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
  const openExternalNav = (lat, lng, label = 'Destino', mode = 'd') => { 
    const scheme = Platform.OS === 'ios' ? 'http://maps.apple.com/' : 'google.navigation:';
    const labelEncoded = encodeURIComponent(label);
    
    if (Platform.OS === 'ios') {
      const appleMapsUrl = `${scheme}?ll=${lat},${lng}&q=${labelEncoded}&dirflg=${mode === 'w' ? 'w' : 'd'}`; 
      Linking.openURL(appleMapsUrl);
    } else {
      const googleNavUrl = `${scheme}q=${lat},${lng}&mode=${mode === 'w' ? 'w' : 'd'}`;
      Linking.openURL(googleNavUrl).catch(() => {
        Linking.openURL(`geo:${lat},${lng}?q=${labelEncoded}`);
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

  // --- Funciones de Modales ---
  const openDetailModal = (spot, type) => {
    setSelectedSpot(spot);
    setSelectedType(type);
    setDetailModalVisible(true);
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedSpot(null);
    setSelectedType(null);
  };

  // --- Funciones para filtrar los marcadores ---
  const normalizedSearch = searchText.toLowerCase();

  const filteredFood = foodSpots.filter(s => 
    s.name && s.name.toLowerCase().includes(normalizedSearch)
  );
  const filteredPickup = pickupPoints.filter(p => 
    p.name && p.name.toLowerCase().includes(normalizedSearch)
  );
  const filteredFaculties = faculties.filter(f => 
    f.name && f.name.toLowerCase().includes(normalizedSearch)
  );


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
        
        {/* --- MODIFICADO: Capas usan los arrays filtrados --- */}
        {showFood && filteredFood.map(s => (
          s.coord && <Marker 
            key={s.id} 
            coordinate={{ latitude: s.coord.latitude, longitude: s.coord.longitude }} 
            image={foodIcon} 
            title={s.name || ''} 
            description={s.desc || ''}
            onPress={() => openDetailModal(s, 'food')}
          />
        ))}
        
        {showPickup && filteredPickup.map(p => (
          p.coord && <Marker 
            key={p.id} 
            coordinate={{ latitude: p.coord.latitude, longitude: p.coord.longitude }} 
            image={busIcon} 
            title={p.name || ''} 
            description={p.lines || ''}
            onPress={() => openDetailModal(p, 'pickup')}
          />
        ))}

        {showFaculties && filteredFaculties.map(f => (
          f.coord && <Marker 
            key={f.id} 
            coordinate={{ latitude: f.coord.latitude, longitude: f.coord.longitude }} 
            image={facultyIcon} 
            title={f.name || ''} 
            description={f.desc || ''}
            onPress={() => openDetailModal(f, 'faculty')}
          />
        ))}

      </MapView> 

      {/* --- Barra de Búsqueda --- */}
      <TextInput
        style={styles.searchBar}
        placeholder="Buscar por nombre"
        value={searchText}
        onChangeText={setSearchText}
        placeholderTextColor="#666"
      />

      {/* ... (Indicador de Carga y Botón de Usuario) ... */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Cargando puntos de interés...</Text>
        </View>
      )}
      <TouchableOpacity style={styles.userLocationButton} onPress={centerOnUser}>
        <Text style={{ fontWeight: 'bold' }}>🎯</Text>
      </TouchableOpacity>

      {/* --- NUEVO: Botón de Filtros --- */}
      <TouchableOpacity 
        style={styles.filterButton} 
        onPress={() => setFilterModalVisible(true)}
      >
        <Text style={styles.filterButtonText}>Filtros ▾</Text>
      </TouchableOpacity>
      
      {/* --- Modal de Detalles --- */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={detailModalVisible} // Modificado
        onRequestClose={closeDetailModal} // Modificado
      >
        <Pressable style={styles.modalBackground} onPress={closeDetailModal}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {selectedSpot && (
              <>
                <Text style={styles.modalTitle}>{selectedSpot.name}</Text>
                {selectedType === 'pickup' ? (
                  <Text style={styles.modalDesc}>Líneas: {selectedSpot.lines || 'No especificadas'}</Text>
                ) : (
                  <Text style={styles.modalDesc}>{selectedSpot.desc || 'No hay descripción disponible.'}</Text>
                )}

                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity 
                    style={[styles.modalButtonSmall, {backgroundColor: '#007AFF'}]} 
                    onPress={() => {
                      openExternalNav(selectedSpot.coord.latitude, selectedSpot.coord.longitude, selectedSpot.name, 'w'); 
                      closeDetailModal();
                    }}
                  >
                    <Text style={styles.modalButtonText}>Ir Caminando 🚶</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalButtonSmall, {backgroundColor: '#4CD964'}]} 
                    onPress={() => {
                      openExternalNav(selectedSpot.coord.latitude, selectedSpot.coord.longitude, selectedSpot.name, 'd'); 
                      closeDetailModal();
                    }}
                  >
                    <Text style={styles.modalButtonText}>Ir en Carro 🚗</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={closeDetailModal}>
                  <Text style={styles.closeButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* --- NUEVO: Modal de Filtros --- */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable style={styles.modalBackground} onPress={() => setFilterModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Mostrar en el mapa</Text>
            
            <View style={styles.filterChipContainer}>
              <Chip 
                label={showFood ? '✅ Comida' : '⬜️ Comida'} 
                onPress={() => setShowFood(v => !v)} 
                isActive={showFood}
              />
              <Chip 
                label={showPickup ? '✅ Paradas' : '⬜️ Paradas'} 
                onPress={() => setShowPickup(v => !v)} 
                isActive={showPickup}
              />
              <Chip 
                label={showFaculties ? '✅ Facultades' : '⬜️ Facultades'} 
                onPress={() => setShowFaculties(v => !v)} 
                isActive={showFaculties}
              />
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      
    </View>
  );
}

// --- MODIFICADO: El Chip ahora acepta 'isActive' ---
const Chip = ({ label, onPress, isActive }) => (
  <TouchableOpacity 
    onPress={onPress} 
    style={[
      styles.chip, 
      isActive ? styles.chipActive : styles.chipInactive 
    ]}
  >
    <Text style={isActive ? styles.chipActiveText : styles.chipInactiveText}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: '100%', height: '100%' },
  
  searchBar: {
    position: 'absolute',
    top: 60, 
    left: 20,
    right: 20,
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 30,
    borderColor: '#ddd',
    borderWidth: 1,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },

  // --- MODIFICADO: Estilos de Filtros ---
  filterButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Contenedor para los chips DENTRO del modal de filtros
  filterChipContainer: {
    marginVertical: 20,
    gap: 10,
  },
  chip: { 
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10, 
    margin: 2, 
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: '#E0EFFF',
    borderColor: '#007AFF',
  },
  chipInactive: {
    backgroundColor: '#F0F0F0',
    borderColor: '#CCC',
  },
  chipActiveText: {
    fontWeight: 'bold',
    color: '#007AFF',
    fontSize: 16,
  },
  chipInactiveText: {
    fontWeight: '500',
    color: '#555',
    fontSize: 16,
  },
  
  userLocationButton: {
    position: 'absolute',
    top: 130, 
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

  // --- Estilos del Modal ---
  modalBackground: {
    flex: 1,
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 22,
    paddingBottom: 30,
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
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButtonSmall: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 15,
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