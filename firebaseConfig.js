import { initializeApp } from 'firebase/app';
// Asegúrate de importar getFirestore, no getAnalytics
import { getFirestore } from 'firebase/firestore'; 

// Pega tu objeto de configuración de Firebase aquí
const firebaseConfig = {
  apiKey: "AIzaSyBRubDr...", // Tu dato real
  authDomain: "ruta-venado.firebaseapp.com", // Tu dato real
  projectId: "ruta-venado", // Tu dato real
  storageBucket: "ruta-venado.appspot.com", // Tu dato real
  messagingSenderId: "572055401005", // Tu dato real
  appId: "1:572055401005:web:ed122dc31d459c76557ea4", // Tu dato real
  measurementId: "G-Q9PWKDQHX0" // Tu dato real
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar la base de datos de Firestore para usarla en otros archivos
export const db = getFirestore(app);