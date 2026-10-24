/**
 * Script de prueba de verificación para el motor nativo SRI
 */
import { sendSriAutorizacion, detectEnvironmentFromClave } from '../services/sriSoapClient';

async function run() {
  console.log('--- TEST MOTOR SRI NATIVO ---');
  
  // 1. Probar detección de ambiente
  const clavePruebas = '2410202601179001234500110010010000000011234567818'; // dígito 23 = 1
  const claveProd = '2410202601179001234500120010010000000011234567818';    // dígito 23 = 2

  console.log('Ambiente clave pruebas:', detectEnvironmentFromClave(clavePruebas));
  console.log('Ambiente clave producción:', detectEnvironmentFromClave(claveProd));

  // 2. Probar conectividad real con Web Service de Autorización del SRI (consultando clave de prueba)
  console.log('Consultando Web Service oficial de Autorización del SRI (Pruebas)...');
  try {
    const res = await sendSriAutorizacion(clavePruebas, 'PRUEBAS', 10000);
    console.log('Estado devuelto por el SRI:', res.estado);
    console.log('Respuesta recibida correctamente del SRI (Longitud raw:', res.rawResponse.length, 'bytes)');
  } catch (err: any) {
    console.log('Error conectando al SRI:', err.message);
  }

  console.log('--- TEST FINALIZADO CON ÉXITO ---');
}

run();
