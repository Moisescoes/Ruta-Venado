// Polyfill para btoa y atob, requerido por Firebase en React Native
import { decode, encode } from 'base-64'
if (!global.btoa) { global.btoa = encode; }
if (!global.atob) { global.atob = decode; }

// Imports de React y Componentes Nativos
import * as React from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, Linking, 
  Platform, Alert, ActivityIndicator, Modal, 
  Pressable, ScrollView, TextInput 
} from 'react-native';

// Imports de Safe Area (para adaptabilidad de pantalla)
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'; 

// Imports de Mapa
import MapView, { Marker, UrlTile } from 'react-native-maps';

// Imports de Funcionalidad
import * as Location from 'expo-location'; 

// Imports de Firebase (Base de Datos)
import { db } from './firebaseConfig'; 
import { collection, getDocs } from 'firebase/firestore'; 

// Imports de Recursos (Iconos Personalizados)
const foodIcon = require('./assets/icons/food.png');
const busIcon = require('./assets/icons/bus.png');
const facultyIcon = require('./assets/icons/faculty.png');


/**
 * Calcula la distancia en KM entre dos coordenadas (Fórmula Haversine).
 * Se usa para estimar el tiempo de caminata.
 */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    0.5 - Math.cos(dLat)/2 + 
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2;

  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Estima el tiempo de caminata (aprox. 5 km/h) basado en la distancia.
 */
function calculateWalkingTime(distanceInKm) {
  const walkingSpeedKmh = 5; // Velocidad promedio caminando (km/h)
  const timeHours = distanceInKm / walkingSpeedKmh;
  const timeMinutes = Math.round(timeHours * 60);

  if (timeMinutes < 1) {
    return "Menos de 1 min caminando";
  }
  return `Aprox. ${timeMinutes} min caminando`;
}

/**
 * Componente principal de la aplicación del mapa.
 * Contiene toda la lógica de estado, mapa y modales.
 */
function App() {
  // Hook para los insets (notch/barra de gestos) y adaptabilidad
  const insets = useSafeAreaInsets(); 

  // Referencia al mapa para controlarlo (ej. centrar)
  const mapRef = React.useRef(null);
  
  // Coordenada central del mapa (FCAeI)
  const center = { latitude: 18.9816298, longitude: -99.2381597 };

  // --- Estados de Datos ---
  // Almacenan los puntos de interés cargados desde Firestore
  const [foodSpots, setFoodSpots] = React.useState([]);
  const [faculties, setFaculties] = React.useState([]);
  const [pickupPoints, setPickupPoints] = React.useState([]);
  
  // --- Estados de Filtros ---
  // Controlan la visibilidad de las capas
  const [showFood, setShowFood] = React.useState(true);
  const [showPickup, setShowPickup] = React.useState(true);
  const [showFaculties, setShowFaculties] = React.useState(true);
  
  // --- Estados de UI y Búsqueda ---
  const [userLocation, setUserLocation] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true); 
  const [searchText, setSearchText] = React.useState('');

  // --- Estados de Modales ---
  const [detailModalVisible, setDetailModalVisible] = React.useState(false);
  const [filterModalVisible, setFilterModalVisible] = React.useState(false);
  const [selectedSpot, setSelectedSpot] = React.useState(null);
  const [selectedType, setSelectedType] = React.useState(null); 
  const [walkingInfo, setWalkingInfo] = React.useState(''); 

  /**
   * Hook de efecto principal: Se ejecuta una vez al montar la app.
   * Inicia el centrado del mapa, la carga de datos y el observador de ubicación.
   */
  React.useEffect(() => {
    // Anima la cámara a la posición inicial
    const onReady = () => {
      mapRef.current?.animateCamera({ center, zoom: 19.5, heading: 0, pitch: 0 }, { duration: 600 });
    };

    // Carga inicial de todas las colecciones desde Firestore
    const fetchAllData = async () => {
      try {
        setIsLoading(true); // Mostrar indicador de carga
        
        // Cargar las 3 colecciones en paralelo
        const [foodQuery, pickupQuery, facultyQuery] = await Promise.all([
          getDocs(collection(db, "foodSpots")),
          getDocs(collection(db, "pickupPoints")),
          getDocs(collection(db, "faculties"))
        ]);

        const foodData = foodQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFoodSpots(foodData);
        
        const pickupData = pickupQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPickupPoints(pickupData);

        const facultyData = facultyQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFaculties(facultyData);

        console.log("Datos cargados!");

      } catch (error) {
        console.error("Error al cargar datos desde Firestore: ", error);
        Alert.alert("Error", "No se pudieron cargar los puntos de interés.");
      } finally {
        setIsLoading(false); // Ocultar indicador de carga
      }
    };
    
    // Observador de la ubicación del usuario en tiempo real
    let locationSubscriber = null;
    const startWatchingLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'No se puede mostrar la ubicación sin permisos.');
        return;
      }

      // Inicia el observador para actualizaciones en vivo
      locationSubscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000, // Actualiza cada 2 segundos
          distanceInterval: 10, // O cada 10 metros
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setUserLocation({ latitude, longitude }); // Actualiza el estado en vivo
        }
      );
    };

    // Ejecutar funciones al montar
    requestAnimationFrame(onReady);
    fetchAllData(); 
    startWatchingLocation();

    // Limpieza al desmontar (ahorra batería)
    return () => {
      if (locationSubscriber) {
        locationSubscriber.remove(); 
      }
    };
  }, []); 

  /**
   * Abre la app de mapas nativa (Google/Apple) con el modo de viaje.
   * @param mode 'd' (driving) o 'w' (walking)
   */
  const openExternalNav = (lat, lng, label = 'Destino', mode = 'd') => { 
    const scheme = Platform.OS === 'ios' ? 'http://maps.apple.com/' : 'google.navigation:';
    const labelEncoded = encodeURIComponent(label);
    
    if (Platform.OS === 'ios') {
      const appleMapsUrl = `${scheme}?ll=${lat},${lng}&q=${labelEncoded}&dirflg=${mode}`; 
      Linking.openURL(appleMapsUrl);
    } else {
      const googleNavUrl = `${scheme}q=${lat},${lng}&mode=${mode}`;
      Linking.openURL(googleNavUrl).catch(() => {
        // Fallback si la navegación falla
        Linking.openURL(`geo:${lat},${lng}?q=${labelEncoded}`);
      });
    }
  };

  /**
   * Anima el mapa para centrarlo en la ubicación actual del usuario.
   */
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

  // --- Funciones de Control de Modales ---

  /**
   * Abre el modal de detalles del marcador y calcula la distancia.
   */
  const openDetailModal = (spot, type) => {
    setSelectedSpot(spot);
    setSelectedType(type);

    // Calcular distancia y tiempo si tenemos la ubicación del usuario
    if (userLocation && spot.coord) {
      const distKm = getHaversineDistance(
        userLocation.latitude, 
        userLocation.longitude,
        spot.coord.latitude,
        spot.coord.longitude
      );
      
      const timeMsg = calculateWalkingTime(distKm);
      const distMsg = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
      
      setWalkingInfo(`📍 ${timeMsg} (${distMsg})`); // Ej: "📍 Aprox. 5 min caminando (0.8 km)"
    } else {
      setWalkingInfo(''); // Limpiar si no hay info
    }

    setDetailModalVisible(true);
  };

  /**
   * Cierra el modal de detalles y limpia los estados.
   */
  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedSpot(null);
    setSelectedType(null);
    setWalkingInfo(''); // Limpiar al cerrar
  };

  // --- Lógica de Búsqueda y Filtros ---
  
  // Normaliza el texto de búsqueda para ser insensible a mayúsculas
  const normalizedSearch = searchText.toLowerCase();

  // Arrays filtrados basados en el estado 'searchText'
  const filteredFood = foodSpots.filter(s => 
    s.name && s.name.toLowerCase().includes(normalizedSearch)
  );
  const filteredPickup = pickupPoints.filter(p => 
    p.name && p.name.toLowerCase().includes(normalizedSearch)
  );
  const filteredFaculties = faculties.filter(f => 
    f.name && f.name.toLowerCase().includes(normalizedSearch)
  );

  // --- Estilos Dinámicos (Safe Area) ---
  // Se recalculan en cada render para adaptarse a los 'insets'
  const searchBarStyle = [
    styles.searchBar,
    { top: insets.top + 10 } // 10px por debajo del notch
  ];
  
  const userLocationButtonStyle = [
    styles.userLocationButton,
    { top: insets.top + 80 } // Debajo de la barra de búsqueda
  ];

  const filterButtonStyle = [
    styles.filterButton,
    { bottom: insets.bottom + 10 } // 10px por encima de la barra de gestos
  ];

  const modalContentStyle = [
    styles.modalContent,
    { paddingBottom: insets.bottom + 22 } // Padding extra para la barra de gestos
  ];


  // --- Renderizado del Componente ---
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
        {/* Capa de Mapa Base (MapTiler) */}
        <UrlTile
          urlTemplate="https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=Uhmy6q3KUCQAb59oD9g7"
          maximumZ={20}
          zIndex={-1}
        />
        
        {/* Marcador Central (FCAeI) */}
        <Marker coordinate={center} title="Edificio Principal" description="FCAeI" />
        
        {/* --- Capas Dinámicas (desde Firebase) --- */}

        {/* Capa de Comida */}
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
        
        {/* Capa de Paradas */}
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

        {/* Capa de Facultades */}
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

      {/* --- Elementos de UI Flotantes --- */}

      {/* Barra de Búsqueda */}
      <TextInput
        style={searchBarStyle}
        placeholder="Buscar por nombre"
        value={searchText}
        onChangeText={setSearchText}
        placeholderTextColor="#666"
      />

      {/* Indicador de Carga */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Cargando puntos de interés...</Text>
        </View>
      )}
      
      {/* Botón de Ubicación */}
      <TouchableOpacity style={userLocationButtonStyle} onPress={centerOnUser}>
        <Text style={{ fontWeight: 'bold' }}>🎯</Text>
      </TouchableOpacity>

      {/* Botón de Filtros */}
      <TouchableOpacity 
        style={filterButtonStyle} 
        onPress={() => setFilterModalVisible(true)}
      >
        <Text style={styles.filterButtonText}>Filtros ▾</Text>
      </TouchableOpacity>
      
      {/* --- Modales --- */}

      {/* Modal: Detalles del Marcador */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={detailModalVisible}
        onRequestClose={closeDetailModal}
      >
        <Pressable style={styles.modalBackground} onPress={closeDetailModal}>
          <Pressable style={modalContentStyle} onPress={() => {}}>
            {selectedSpot && (
              <>
                <Text style={styles.modalTitle}>{selectedSpot.name}</Text>
                
                {/* Muestra descripción o líneas de autobús */}
                {selectedType === 'pickup' ? (
                  <Text style={styles.modalDesc}>Líneas: {selectedSpot.lines || 'No especificadas'}</Text>
                ) : (
                  <Text style={styles.modalDesc}>{selectedSpot.desc || 'No hay descripción disponible.'}</Text>
                )}

                {/* Info de Distancia y Tiempo de Caminata */}
                {walkingInfo && (
                  <Text style={styles.modalDistance}>{walkingInfo}</Text>
                )}

                {/* Botones de Navegación (Caminar / Carro) */}
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

                {/* Botón de Cerrar Modal */}
                <TouchableOpacity style={styles.closeButton} onPress={closeDetailModal}>
                  <Text style={styles.closeButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Filtros de Capas */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable style={styles.modalBackground} onPress={() => setFilterModalVisible(false)}>
          <Pressable style={modalContentStyle} onPress={() => {}}>
            <Text style={styles.modalTitle}>Mostrar en el mapa</Text>
            
            {/* Contenedor de los botones de filtro */}
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

/**
 * Wrapper principal que provee el contexto de Safe Area a la App.
 * Este es el componente que se exporta por defecto.
 */
export default function AppWrapper() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}


/**
 * Componente reutilizable para los botones de filtro (Chips).
 * Cambia de estilo si está activo o inactivo.
 */
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

// --- Hoja de Estilos ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  map: { 
    width: '100%', 
    height: '100%' 
  },
  
  // Estilo para la barra de búsqueda superior
  searchBar: {
    position: 'absolute',
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

  // Estilo para el botón flotante de Filtros
  filterButton: {
    position: 'absolute',
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
  
  // Estilos para los Chips dentro del modal de filtros
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
  
  // Estilo para el botón flotante de Ubicación
  userLocationButton: {
    position: 'absolute',
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
  
  // Estilo para el overlay de "Cargando..."
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Asegura que esté sobre el mapa
  },

  // --- Estilos para los Modales ---
  modalBackground: {
    flex: 1,
    justifyContent: 'flex-end', // Ancla el modal abajo
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
    marginBottom: 4,
  },
  // Estilo para el texto de distancia/tiempo
  modalDistance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 20,
  },
  // Contenedor para los 2 botones (Caminar/Carro)
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButtonSmall: {
    flex: 1, // Hace que ambos botones ocupen el mismo espacio
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