const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { sql, getPool } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const fs = require('fs');

const router = express.Router();

// ============================================================
// Configuración de subida de archivos (multer)
// Por ahora guarda en disco local (./uploads). Más adelante,
// cuando montemos MinIO/S3, solo cambiamos esta parte.
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOADS_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const nombreUnico = crypto.randomUUID() + path.extname(file.originalname);
    cb(null, nombreUnico);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB máximo, ajustable
});
// ============================================================
//Validación de extensiones permitidas por tipo de entrada
// ============================================================
const EXTENSIONES_PERMITIDAS = {
  foto: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  documento: ['.pdf', '.doc', '.docx', '.odt'],
  video: ['.mp4', '.webm', '.mov', '.avi'],
};

function extensionValida(tipo, nombreArchivo) {
  const ext = path.extname(nombreArchivo).toLowerCase();
  return EXTENSIONES_PERMITIDAS[tipo]?.includes(ext) ?? false;
}

// ============================================================
//Función auxiliar para generar miniatura de video
// ============================================================
function generarMiniaturaVideo(rutaVideoCompleta, nombreArchivoSalida, carpetaSalida) {
  return new Promise((resolve, reject) => {
    ffmpeg(rutaVideoCompleta)
      .on('end', () => resolve(nombreArchivoSalida))
      .on('error', (err) => reject(err))
      .screenshots({
        timestamps: ['1'],       // captura el fotograma del segundo 1 del vídeo
        filename: nombreArchivoSalida,
        folder: carpetaSalida,
        size: '480x?',           // 480px de ancho, alto proporcional automático
      });
  });
}



// ============================================================
// GET /api/entradas
// Ruta PÚBLICA. Lista entradas con filtros opcionales:
// ?anio=1985&tipo=foto&etiqueta=fiestas&buscar=texto
// ============================================================
router.get('/', async (req, res) => {
  const { anio, tipo, etiqueta, buscar } = req.query;

  try {
    const pool = await getPool();
    const request = pool.request();

    let query = 'SELECT * FROM dbo.VistaEntradas WHERE 1 = 1';

    if (anio) {
      query += ' AND Anio = @anio';
      request.input('anio', sql.SmallInt, Number(anio));
    }
    if (tipo) {
      query += ' AND Tipo = @tipo';
      request.input('tipo', sql.NVarChar, tipo);
    }
    if (etiqueta) {
      query += ' AND Etiquetas LIKE @etiqueta';
      request.input('etiqueta', sql.NVarChar, `%${etiqueta}%`);
    }
    if (buscar) {
      query += ' AND Nombre LIKE @buscar';
      request.input('buscar', sql.NVarChar, `%${buscar}%`);
    }

    query += ' ORDER BY Anio DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las entradas' });
  }
});

// ============================================================
// GET /api/entradas/:id
// Ruta PÚBLICA. Detalle de una entrada, incluyendo sus campos
// específicos según el tipo (foto/documento/video).
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();

    const base = await pool
      .request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query('SELECT * FROM dbo.Entradas WHERE Id = @id');

    const entrada = base.recordset[0];
    if (!entrada) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    const tablaPorTipo = { foto: 'Fotos', documento: 'Documentos', video: 'Videos' };
    const tabla = tablaPorTipo[entrada.Tipo];

    const detalle = await pool
      .request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query(`SELECT * FROM dbo.${tabla} WHERE EntradaId = @id`);

    const etiquetas = await pool
      .request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query(`
        SELECT et.Nombre FROM dbo.EntradaEtiqueta ee
        JOIN dbo.Etiquetas et ON et.Id = ee.EtiquetaId
        WHERE ee.EntradaId = @id
      `);

    res.json({
      ...entrada,
      detalle: detalle.recordset[0] || null,
      etiquetas: etiquetas.recordset.map((e) => e.Nombre),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la entrada' });
  }
});

// ============================================================
// POST /api/entradas
// Ruta PROTEGIDA (solo admin). Crea una entrada nueva + su fichero.
// Body: multipart/form-data con campos "nombre", "anio", "tipo",
// "etiquetas" (separadas por coma) y el archivo en "archivo".
// ============================================================
router.post('/', requireAdmin, upload.single('archivo'), async (req, res) => {
  const { nombre, anio, tipo, etiquetas } = req.body;

  if (!nombre || !anio || !tipo || !req.file) {
    return res.status(400).json({ error: 'Faltan campos obligatorios o el archivo' });
  }
  if (!['foto', 'documento', 'video'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo no válido' });
  }
    if (!extensionValida(tipo, req.file.originalname)) {
    fs.unlink(req.file.path, () => {}); // borramos el archivo mal subido, no lo dejamos huérfano en disco
    return res.status(400).json({
      error: `El archivo no corresponde con el tipo "${tipo}". Formatos permitidos: ${EXTENSIONES_PERMITIDAS[tipo].join(', ')}`
    });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const idEntrada = crypto.randomUUID();

    await new sql.Request(transaction)
      .input('id', sql.UniqueIdentifier, idEntrada)
      .input('nombre', sql.NVarChar, nombre)
      .input('anio', sql.SmallInt, Number(anio))
      .input('tipo', sql.NVarChar, tipo)
      .input('creadoPor', sql.UniqueIdentifier, req.admin.id)
      .query(`
        INSERT INTO dbo.Entradas (Id, Nombre, Anio, Tipo, CreadoPor)
        VALUES (@id, @nombre, @anio, @tipo, @creadoPor)
      `);

        const tablaPorTipo = { foto: 'Fotos', documento: 'Documentos', video: 'Videos' };
    const tabla = tablaPorTipo[tipo];

    let nombreMiniatura = null;
    if (tipo === 'video') {
      const carpeta = process.env.UPLOADS_DIR || './uploads';
      nombreMiniatura = `${path.parse(req.file.filename).name}-miniatura.jpg`;
      try {
        await generarMiniaturaVideo(path.join(carpeta, req.file.filename), nombreMiniatura, carpeta);
      } catch (err) {
        console.warn('No se pudo generar la miniatura del vídeo:', err.message);
        nombreMiniatura = null; // seguimos sin romper la creación de la entrada
      }
    }

    await new sql.Request(transaction)
      .input('id', sql.UniqueIdentifier, idEntrada)
      .input('ruta', sql.NVarChar, req.file.filename)
      .input('miniatura', sql.NVarChar, nombreMiniatura)
      .input('formato', sql.NVarChar, path.extname(req.file.originalname).replace('.', ''))
      .input('peso', sql.BigInt, req.file.size)
      .query(`
        INSERT INTO dbo.${tabla} (EntradaId, RutaArchivo, RutaMiniatura, Formato, PesoBytes)
        VALUES (@id, @ruta, @miniatura, @formato, @peso)
      `);

    if (etiquetas) {
      const listaEtiquetas = etiquetas.split(',').map((e) => e.trim()).filter(Boolean);
      for (const nombreEtiqueta of listaEtiquetas) {
        const existente = await new sql.Request(transaction)
          .input('nombre', sql.NVarChar, nombreEtiqueta)
          .query('SELECT Id FROM dbo.Etiquetas WHERE Nombre = @nombre');

        let idEtiqueta;
        if (existente.recordset.length > 0) {
          idEtiqueta = existente.recordset[0].Id;
        } else {
          idEtiqueta = crypto.randomUUID();
          await new sql.Request(transaction)
            .input('id', sql.UniqueIdentifier, idEtiqueta)
            .input('nombre', sql.NVarChar, nombreEtiqueta)
            .query('INSERT INTO dbo.Etiquetas (Id, Nombre) VALUES (@id, @nombre)');
        }

        await new sql.Request(transaction)
          .input('entradaId', sql.UniqueIdentifier, idEntrada)
          .input('etiquetaId', sql.UniqueIdentifier, idEtiqueta)
          .query('INSERT INTO dbo.EntradaEtiqueta (EntradaId, EtiquetaId) VALUES (@entradaId, @etiquetaId)');
      }
    }

    await transaction.commit();
    res.status(201).json({ id: idEntrada, mensaje: 'Entrada creada correctamente' });
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al crear la entrada' });
  }
});

// ============================================================
// PUT /api/entradas/:id
// Ruta PROTEGIDA (solo admin). Edita nombre, año y/o etiquetas
// de una entrada existente, y opcionalmente sustituye el archivo.
// El "tipo" NUNCA se puede cambiar en una edición.
// Body: multipart/form-data, todos los campos opcionales excepto
// que al menos uno debe venir. "archivo" opcional.
// ============================================================
router.put('/:id', requireAdmin, upload.single('archivo'), async (req, res) => {
  const { nombre, anio, etiquetas } = req.body;
  const { id } = req.params;

  if (!nombre && !anio && etiquetas === undefined && !req.file) {
    return res.status(400).json({ error: 'No se ha enviado ningún campo para actualizar' });
  }

  const pool = await getPool();

  // Primero comprobamos que la entrada existe y obtenemos su tipo,
  // necesario para saber en qué tabla hija actualizar el archivo.
  const existente = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('SELECT Tipo FROM dbo.Entradas WHERE Id = @id');

  const entradaActual = existente.recordset[0];
  if (!entradaActual) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }

  // Ahora que ya tenemos entradaActual, podemos validar el archivo si se subió uno
  if (req.file) {
    if (!extensionValida(entradaActual.Tipo, req.file.originalname)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: `El archivo no corresponde con el tipo "${entradaActual.Tipo}". Formatos permitidos: ${EXTENSIONES_PERMITIDAS[entradaActual.Tipo].join(', ')}`
      });
    }
  }

  const tablaPorTipo = { foto: 'Fotos', documento: 'Documentos', video: 'Videos' };
  const tabla = tablaPorTipo[entradaActual.Tipo];

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // --- Actualizar campos comunes (nombre / anio) solo si vinieron ---
    if (nombre || anio) {
      const request = new sql.Request(transaction).input('id', sql.UniqueIdentifier, id);
      const sets = [];
      if (nombre) {
        sets.push('Nombre = @nombre');
        request.input('nombre', sql.NVarChar, nombre);
      }
      if (anio) {
        sets.push('Anio = @anio');
        request.input('anio', sql.SmallInt, Number(anio));
      }
      await request.query(`UPDATE dbo.Entradas SET ${sets.join(', ')} WHERE Id = @id`);
    }

    // --- Sustituir el archivo, si se subió uno nuevo ---
    let rutaAntigua = null;
    if (req.file) {
      const anterior = await new sql.Request(transaction)
        .input('id', sql.UniqueIdentifier, id)
        .query(`SELECT RutaArchivo FROM dbo.${tabla} WHERE EntradaId = @id`);
      rutaAntigua = anterior.recordset[0]?.RutaArchivo || null;

      let nombreMiniatura = null;
      if (entradaActual.Tipo === 'video') {
        const carpeta = process.env.UPLOADS_DIR || './uploads';
        nombreMiniatura = `${path.parse(req.file.filename).name}-miniatura.jpg`;
        try {
          await generarMiniaturaVideo(path.join(carpeta, req.file.filename), nombreMiniatura, carpeta);
        } catch (err) {
          console.warn('No se pudo generar la miniatura del vídeo:', err.message);
          nombreMiniatura = null;
        }
      }

      await new sql.Request(transaction)
        .input('id', sql.UniqueIdentifier, id)
        .input('ruta', sql.NVarChar, req.file.filename)
        .input('miniatura', sql.NVarChar, nombreMiniatura)
        .input('formato', sql.NVarChar, path.extname(req.file.originalname).replace('.', ''))
        .input('peso', sql.BigInt, req.file.size)
        .query(`
          UPDATE dbo.${tabla}
          SET RutaArchivo = @ruta, RutaMiniatura = @miniatura, Formato = @formato, PesoBytes = @peso
          WHERE EntradaId = @id
        `);
    }

    // --- Reemplazar etiquetas, si vino el campo (aunque sea vacío) ---
    if (etiquetas !== undefined) {
      await new sql.Request(transaction)
        .input('id', sql.UniqueIdentifier, id)
        .query('DELETE FROM dbo.EntradaEtiqueta WHERE EntradaId = @id');

      const listaEtiquetas = etiquetas.split(',').map((e) => e.trim()).filter(Boolean);
      for (const nombreEtiqueta of listaEtiquetas) {
        const existenteEtiqueta = await new sql.Request(transaction)
          .input('nombre', sql.NVarChar, nombreEtiqueta)
          .query('SELECT Id FROM dbo.Etiquetas WHERE Nombre = @nombre');

        let idEtiqueta;
        if (existenteEtiqueta.recordset.length > 0) {
          idEtiqueta = existenteEtiqueta.recordset[0].Id;
        } else {
          idEtiqueta = crypto.randomUUID();
          await new sql.Request(transaction)
            .input('id', sql.UniqueIdentifier, idEtiqueta)
            .input('nombre', sql.NVarChar, nombreEtiqueta)
            .query('INSERT INTO dbo.Etiquetas (Id, Nombre) VALUES (@id, @nombre)');
        }

        await new sql.Request(transaction)
          .input('entradaId', sql.UniqueIdentifier, id)
          .input('etiquetaId', sql.UniqueIdentifier, idEtiqueta)
          .query('INSERT INTO dbo.EntradaEtiqueta (EntradaId, EtiquetaId) VALUES (@entradaId, @etiquetaId)');
      }
    }

    await transaction.commit();

    // Borramos el fichero físico antiguo DESPUÉS del commit, para no
    // perder el archivo si la transacción hubiera fallado.
    if (rutaAntigua) {
      const rutaCompleta = path.join(process.env.UPLOADS_DIR || './uploads', rutaAntigua);
      fs.unlink(rutaCompleta, (err) => {
        if (err) console.warn('No se pudo borrar el archivo antiguo:', err.message);
      });
    }

    res.json({ mensaje: 'Entrada actualizada correctamente' });
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la entrada' });
  }
});

// ============================================================
// DELETE /api/entradas/:id
// Ruta PROTEGIDA (solo admin).
// ============================================================
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query('DELETE FROM dbo.Entradas WHERE Id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    // Nota: esto borra el registro en cascada (ver esquema), pero NO borra
    // el fichero físico de ./uploads. Eso lo añadimos en el siguiente paso
    // cuando conectemos con el almacenamiento de objetos.
    res.json({ mensaje: 'Entrada eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la entrada' });
  }
});

module.exports = router;