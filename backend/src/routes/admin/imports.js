const { supabaseAdmin } = require('../../config/supabase');
const { cacheService } = require('../../services/cache');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function uploadHandler(req, res) {
  // This wraps multer
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: { message: 'File upload failed: ' + err.message } });
    
    try {
      const { clientId } = req.params;
      const { target_table, field_mapping } = req.body;
      
      if (!req.file) return res.status(400).json({ error: { message: 'No file provided' } });
      if (!target_table) return res.status(400).json({ error: { message: 'target_table is required' } });

      const csvContent = req.file.buffer.toString('utf-8');
      const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });

      // Create import job
      const { data: job, error: jobError } = await supabaseAdmin
        .from('import_jobs')
        .insert({
          client_id: clientId,
          target_table,
          status: 'parsing',
          file_name: req.file.originalname,
          total_rows: records.length,
          field_mapping: field_mapping ? JSON.parse(field_mapping) : {}
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Parse rows into staging
      let validCount = 0;
      let errorCount = 0;
      const mapping = field_mapping ? JSON.parse(field_mapping) : null;

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        let mappedData = row;
        let errors = [];

        // Apply field mapping if provided
        if (mapping) {
          mappedData = {};
          for (const [csvCol, dbCol] of Object.entries(mapping)) {
            if (row[csvCol] !== undefined) {
              mappedData[dbCol] = row[csvCol];
            }
          }
        }

        // Basic validation
        if (Object.keys(mappedData).length === 0) {
          errors.push({ field: null, error_type: 'empty_row', error_message: 'Row has no mapped data' });
        }

        const status = errors.length > 0 ? 'error' : 'valid';
        if (status === 'valid') validCount++;
        else errorCount++;

        await supabaseAdmin.from('import_job_rows').insert({
          import_job_id: job.id,
          row_number: i + 1,
          raw_data: row,
          mapped_data: mappedData,
          status,
          errors
        });

        if (errors.length > 0) {
          for (const e of errors) {
            await supabaseAdmin.from('import_errors').insert({
              import_job_id: job.id,
              row_number: i + 1,
              field: e.field,
              error_type: e.error_type,
              error_message: e.error_message,
              raw_value: e.raw_value
            });
          }
        }
      }

      // Update job status
      await supabaseAdmin.from('import_jobs').update({
        status: 'ready',
        valid_rows: validCount,
        error_rows: errorCount
      }).eq('id', job.id);

      res.status(201).json({
        job: { ...job, status: 'ready', valid_rows: validCount, error_rows: errorCount },
        preview: records.slice(0, 5),
        columns: records.length > 0 ? Object.keys(records[0]) : []
      });
    } catch (err) {
      console.error('Import error:', err);
      res.status(500).json({ error: { message: err.message } });
    }
  });
}

async function list(req, res) {
  try {
    const { clientId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('import_jobs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ imports: data });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function get(req, res) {
  try {
    const { id } = req.params;
    const { data: job } = await supabaseAdmin.from('import_jobs').select('*').eq('id', id).single();
    const { data: rows } = await supabaseAdmin.from('import_job_rows').select('*').eq('import_job_id', id).order('row_number');
    const { data: errors } = await supabaseAdmin.from('import_errors').select('*').eq('import_job_id', id).order('row_number');
    res.json({ job, rows, errors });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function approve(req, res) {
  try {
    const { clientId, id } = req.params;

    const { data: job } = await supabaseAdmin.from('import_jobs').select('*').eq('id', id).single();
    if (!job || job.status !== 'ready') {
      return res.status(400).json({ error: { message: 'Import job is not ready for approval' } });
    }

    await supabaseAdmin.from('import_jobs').update({ status: 'processing' }).eq('id', id);

    // Get valid rows
    const { data: validRows } = await supabaseAdmin
      .from('import_job_rows')
      .select('mapped_data')
      .eq('import_job_id', id)
      .eq('status', 'valid');

    if (validRows && validRows.length > 0) {
      const insertData = validRows.map(r => ({ ...r.mapped_data, client_id: clientId }));
      const { error: insertError } = await supabaseAdmin.from(job.target_table).insert(insertData);
      
      if (insertError) {
        await supabaseAdmin.from('import_jobs').update({ status: 'failed' }).eq('id', id);
        throw insertError;
      }

      // Mark rows as imported
      await supabaseAdmin
        .from('import_job_rows')
        .update({ status: 'imported' })
        .eq('import_job_id', id)
        .eq('status', 'valid');
    }

    await supabaseAdmin.from('import_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    cacheService.invalidateClient(clientId);

    res.json({ success: true, imported: validRows?.length || 0 });
  } catch (err) {
    console.error('Import approve error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = { upload: uploadHandler, list, get, approve };
