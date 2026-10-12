import bcrypt from 'bcryptjs';
import { getPgPool } from '../config/postgres';

export async function fixSecurityAlerts() {
  const pool = getPgPool();
  console.log('🔒 INICIANDO APLICACIÓN DE PARCHES DE SEGURIDAD...');

  // =========================================================================
  // ALERTA 1: CAMBIO DE CONTRASEÑA DE ADMINISTRADOR Y HASHEO BCRYPT
  // =========================================================================
  const newAdminPassword = 'Admin2026@Daynet#';
  const hashedAdminPassword = await bcrypt.hash(newAdminPassword, 10);

  // 1.1 Actualizar contraseña con hash bcrypt en tabla usuarios_sistema
  const userUpdateRes = await pool.query(`
    UPDATE usuarios_sistema
    SET password = $1, updated_at = NOW()
    WHERE username = '1799999999001' OR id = 'USR-01';
  `, [hashedAdminPassword]);

  console.log(`✓ Contraseña de Administrador actualizada con hash bcrypt en 'usuarios_sistema' (${userUpdateRes.rowCount} filas afectadas).`);

  // 1.2 Limpiar absolutamente cualquier contraseña en texto plano de app_state (ferreteria_settings_users_list)
  const appStateUsersRes = await pool.query(`
    SELECT data FROM app_state WHERE id = 'ferreteria_settings_users_list';
  `);

  if (appStateUsersRes.rows.length > 0) {
    let rowData = appStateUsersRes.rows[0].data;
    let usersList = Array.isArray(rowData) ? rowData : (rowData?.data || []);

    if (Array.isArray(usersList)) {
      const sanitizedUsers = usersList.map((u: any) => {
        const { password, ...clean } = u;
        return clean;
      });

      await pool.query(`
        UPDATE app_state
        SET data = $1::jsonb, updated_at = NOW()
        WHERE id = 'ferreteria_settings_users_list';
      `, [JSON.stringify(sanitizedUsers)]);

      console.log(`✓ Eliminadas contraseñas en texto plano de 'ferreteria_settings_users_list' en app_state.`);
    }
  }

  // =========================================================================
  // ALERTA 2: ELIMINAR CLAVES P12 DE APP_STATE Y PROTEGER CERTIFICADOS_SRI
  // =========================================================================
  const p12DeleteRes = await pool.query(`
    DELETE FROM app_state
    WHERE id IN (
      'ferreteria_settings_p12_password',
      'ferreteria_settings_p12_base64',
      'ferreteria_settings_p12_filename',
      'ferreteria_settings_p12_filesize',
      'ferreteria_settings_p12_upload_date'
    );
  `);

  console.log(`✓ Eliminadas ${p12DeleteRes.rowCount} entradas de firma electrónica (.p12) de la tabla 'app_state'.`);

  // 2.1 Asegurar que la tabla segura 'certificados_sri' exista
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificados_sri (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'active_certificate',
      p12_base64 TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      iv VARCHAR(64) NOT NULL,
      environment VARCHAR(20) DEFAULT 'PRUEBAS',
      status VARCHAR(20) DEFAULT 'ACTIVO',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(50)
    );
  `);
  console.log(`✓ Tabla segura 'certificados_sri' verificada.`);

  console.log('🎉 Parches de seguridad aplicados con éxito.');
  return { newAdminPassword };
}

if (process.argv[1]?.includes('fixSecurityAlerts')) {
  fixSecurityAlerts()
    .then((res) => {
      console.log('\nCredenciales nuevas de Administrador:');
      console.log('Usuario: 1799999999001');
      console.log('Contraseña nueva:', res.newAdminPassword);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error aplicando parches de seguridad:', err);
      process.exit(1);
    });
}
