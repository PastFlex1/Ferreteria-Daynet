import { useState } from 'react';
import { useModal } from '../context/ModalContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { validateEcuadorianDocument } from '../utils/ecuadorianValidator';

export interface CustomerData {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export function useCedulaSearch() {
  const { showToast } = useModal();
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);

  const fetchCedulaData = async (cedula: string, onFound: (data: CustomerData) => void) => {
    // 1. Validar documento usando el verificador ecuatoriano
    const validation = validateEcuadorianDocument('AUTO', cedula);
    if (!validation.isValid) {
      showToast("Documento inválido. Verifique e intente de nuevo.", "warning");
      return;
    }
    
    setIsSearchingCedula(true);
    try {
      // 2. Primero busca localmente en Firebase
      if (db) {
        const qDoc = query(collection(db, "customers"), where("docNumber", "==", cedula));
        let snap = await getDocs(qDoc);
        if (snap.empty) {
          const qRuc = query(collection(db, "customers"), where("ruc", "==", cedula));
          snap = await getDocs(qRuc);
        }
        if (!snap.empty) {
          const data = snap.docs[0].data();
          onFound({
            name: data.name || "",
            ...(data.address && { address: data.address }),
            ...(data.email && { email: data.email }),
            ...(data.phone && { phone: data.phone })
          });
          showToast("Cliente encontrado en la base de datos.", "success");
          setIsSearchingCedula(false);
          return;
        }
      }

      // 3. Si no existe en Firebase, busca en el Registro Civil usando infoplacas y SECAP
      const searchDoc = cedula.length === 13 ? cedula.substring(0, 10) : cedula;
      let foundName = '';

      // Intento 1: Proxy de infoplacas (con cabecera requerida X-Requested-With)
      try {
        const proxyUrl = 'https://infoplacas.herokuapp.com/';
        const targetUrl = 'https://si.secap.gob.ec/sisecap/logeo_web/json/busca_persona_registro_civil.php';
        
        const response = await fetch(proxyUrl + targetUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: new URLSearchParams({ documento: searchDoc, tipo: '1' })
        });

        if (response.ok) {
          const text = await response.text();
          if (text) {
            const data = JSON.parse(text);
            if (data && data.nombreCompleto) {
              foundName = data.nombreCompleto;
            } else if (data && data.nombre) {
              foundName = data.nombre;
            } else if (data && data.nombres && data.apellidos) {
              foundName = `${data.apellidos} ${data.nombres}`;
            }
          }
        }
      } catch (e) {
        console.warn('Infoplacas proxy fallback:', e);
      }

      // Intento 2: Backend Java Local si el proxy externo falla
      if (!foundName) {
        try {
          const resLocal = await fetch(`/api/sri/consultar-cedula/${searchDoc}`);
          if (resLocal.ok) {
            const raw = await resLocal.text();
            if (raw) {
              const data = JSON.parse(raw);
              if (data.nombreCompleto) {
                foundName = data.nombreCompleto;
              } else if (data.nombre) {
                foundName = data.nombre;
              } else if (data.nombres && data.apellidos) {
                foundName = `${data.apellidos} ${data.nombres}`;
              }
            }
          }
        } catch (err) {}
      }

      if (foundName) {
        onFound({ name: foundName.trim() });
        showToast(`Datos del Registro Civil autocompletados: ${foundName.trim()}`, 'success');
      } else {
        showToast('No se encontró el nombre en el Registro Civil para este documento.', 'info');
      }
    } catch (error) {
      console.error('Error al buscar cédula:', error);
    } finally {
      setIsSearchingCedula(false);
    }
  };

  return { isSearchingCedula, fetchCedulaData };
}
