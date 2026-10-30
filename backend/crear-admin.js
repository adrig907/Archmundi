require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const readline = require('readline');
const { sql, getPool } = require('./src/db');

// Uso: node crear-admin.js
// Te pedirá email, nombre y contraseña por terminal, y creará
// el registro en dbo.Administradores con la contraseña ya hasheada.

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function preguntar(texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

async function main() {
  const email = await preguntar('Email del administrador: ');
  const nombre = await preguntar('Nombre completo: ');
  const password = await preguntar('Contraseña: ');
  rl.close();

  if (!email || !nombre || !password) {
    console.error('Todos los campos son obligatorios.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  try {
    const pool = await getPool();

    // Comprobamos que no exista ya un admin con ese email
    const existente = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT Id FROM dbo.Administradores WHERE Email = @email');

    if (existente.recordset.length > 0) {
      console.error('Ya existe un administrador con ese email.');
      process.exit(1);
    }

    await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('email', sql.NVarChar, email)
      .input('nombre', sql.NVarChar, nombre)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .query(`
        INSERT INTO dbo.Administradores (Id, Email, PasswordHash, Nombre)
        VALUES (@id, @email, @passwordHash, @nombre)
      `);

    console.log('Administrador creado correctamente.');
    console.log('Email:', email);
    console.log('Ya puedes iniciar sesión en POST /api/auth/login con ese email y tu contraseña.');
  } catch (err) {
    console.error('Error al crear el administrador:', err.message);
  } finally {
    process.exit(0);
  }
}

main();