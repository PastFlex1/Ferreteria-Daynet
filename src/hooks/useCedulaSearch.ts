import { useState } from 'react';
import { useModal } from '../context/ModalContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { validateEcuadorianDocument } from '../utils/ecuadorianValidator';
import { SriBackendService } from '../services/sriBackendService';

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
    const cleanDoc = (cedula || '').trim();
    if (!cleanDoc) return;

    // 1. Validar documento usando el verificador ecuatoriano
    const validation = validateEcuadorianDocument('AUTO', cleanDoc);
    if (!validation.isValid) {
      showToast("Documento inválido. Verifique e intente de nuevo.", "warning");
      return;
    }
    
    setIsSearchingCedula(true);
    try {
      // 2. Primero busca localmente en Firebase (Clientes y Proveedores)
      if (db) {
        try {
          // Buscar en Customers
          const qDoc = query(collection(db, "customers"), where("docNumber", "==", cleanDoc));
          let snap = await getDocs(qDoc);
          if (snap.empty) {
            const qRuc = query(collection(db, "customers"), where("ruc", "==", cleanDoc));
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
            showToast("Contacto encontrado en la base de datos local.", "success");
            setIsSearchingCedula(false);
            return;
          }

          // Buscar en Suppliers
          const qSup = query(collection(db, "ferreteria_suppliers_details"), where("taxId", "==", cleanDoc));
          const snapSup = await getDocs(qSup);
          if (!snapSup.empty) {
            const data = snapSup.docs[0].data();
            onFound({
              name: data.name || "",
              ...(data.address && { address: data.address }),
              ...(data.email && { email: data.email }),
              ...(data.phone && { phone: data.phone })
            });
            showToast("Proveedor encontrado en la base de datos.", "success");
            setIsSearchingCedula(false);
            return;
          }
        } catch (e) {
          console.warn('Firebase search fallback:', e);
        }
      }

      const searchDoc = cleanDoc.length === 13 ? cleanDoc.substring(0, 10) : cleanDoc;
      let foundName = '';
      let foundAddress = '';

      // Intento 1: API Pública SRI Móvil (RUC / Cédula)
      try {
        const sriRes = await fetch(`https://srienlinea.sri.gob.ec/movil-servicios/api/v1.0/deuda/consultarPorNumeroIdentificacion?numeroIdentificacion=${cleanDoc}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (sriRes.ok) {
          const sriData = await sriRes.json();
          if (sriData?.contribuyente?.razonSocial || sriData?.contribuyente?.nombreComercial) {
            foundName = (sriData.contribuyente.razonSocial || sriData.contribuyente.nombreComercial).trim();
          }
        }
      } catch (e) {
        // SRI en línea falló o tiene CORS
      }

      // Intento 2: Proxy SECAP Registro Civil
      if (!foundName) {
        const secapUrl = 'https://si.secap.gob.ec/sisecap/logeo_web/json/busca_persona_registro_civil.php';
        
        // Proxy 1: Infoplacas
        try {
          const response = await fetch('https://infoplacas.herokuapp.com/' + secapUrl, {
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

        // Proxy 2: Allorigins fallback si infoplacas no responde
        if (!foundName) {
          try {
            const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${secapUrl}?documento=${searchDoc}&tipo=1`)}`;
            const resAll = await fetch(allOriginsUrl);
            if (resAll.ok) {
              const text = await resAll.text();
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
          } catch (e) {}
        }
      }

      // Intento 3: Backend Java Local si está disponible
      if (!foundName) {
        try {
          const baseUrl = SriBackendService.getBaseUrl();
          const resLocal = await fetch(`${baseUrl}/api/sri/consultar-cedula/${searchDoc}`);
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

      // Intento 4: Backend Java Local para RUC
      if (!foundName && cleanDoc.length === 13) {
        try {
          const baseUrl = SriBackendService.getBaseUrl();
          const resLocalRuc = await fetch(`${baseUrl}/api/sri/consultar-ruc/${cleanDoc}`);
          if (resLocalRuc.ok) {
            const raw = await resLocalRuc.text();
            if (raw) {
              const data = JSON.parse(raw);
              if (data.razonSocial || data.nombreComercial) {
                foundName = data.razonSocial || data.nombreComercial;
                if (data.direccion) foundAddress = data.direccion;
              }
            }
          }
        } catch (err) {}
      }

      if (foundName) {
        onFound({ 
          name: foundName.trim(),
          ...(foundAddress && { address: foundAddress.trim() })
        });
        showToast(`Datos autocompletados: ${foundName.trim()}`, 'success');
      } else {
        showToast('No se encontró el nombre en el Registro Civil / SRI para este documento.', 'info');
      }
    } catch (error) {
      console.error('Error al buscar cédula/RUC:', error);
      showToast('Error al consultar el documento.', 'warning');
    } finally {
      setIsSearchingCedula(false);
    }
  };

  return { isSearchingCedula, fetchCedulaData };
}
