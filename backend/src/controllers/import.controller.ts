import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  ASSET_FIELDS, SIMPLE_FIELDS, parseExcelPreview, suggestMapping, executeImport, executeSimpleImport, executeFirewallImport,
} from '../services/import.service';
import { audit } from '../services/audit.service';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export const importRouter = Router();
importRouter.use(authMiddleware);

// Get target field metadata for an asset type
importRouter.get('/fields/:assetType', (req, res) => {
  const fields = ASSET_FIELDS[String(req.params.assetType)];
  if (!fields) return res.status(404).json({ error: 'Unknown asset type' });
  res.json(fields);
});

// Preview an uploaded xlsx — returns sheets, headers, sample rows + suggested mapping
importRouter.post('/preview/:assetType', upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const assetType = String(req.params.assetType);
  const fields = ASSET_FIELDS[assetType] || SIMPLE_FIELDS[assetType];
  if (!fields) return res.status(400).json({ error: 'Unknown asset type' });

  try {
    const sheets = parseExcelPreview(req.file.buffer);
    const sheetsWithMapping = sheets.map((s) => ({
      ...s,
      suggestedMapping: suggestMapping(s.headers, assetType),
    }));
    res.json({ sheets: sheetsWithMapping, fields });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Execute import (or dry-run preview)
importRouter.post('/commit/:assetType', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const assetType = String(req.params.assetType);
  const { sheetName, mapping, dryRun } = req.body;
  if (!sheetName || !mapping) return res.status(400).json({ error: 'sheetName and mapping required' });
  const parsedMapping: Record<string, string | null> = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
  const isDryRun = dryRun === 'true' || dryRun === true;

  try {
    let result;

    if (assetType === 'firewall') {
      result = await executeFirewallImport({
        buffer: req.file.buffer,
        sheetName,
        mapping: parsedMapping,
        dryRun: isDryRun,
        userId: req.user!.id,
      });
    } else if (SIMPLE_FIELDS[assetType]) {
      // Non-asset simple import (incidents / activities)
      result = await executeSimpleImport({
        buffer: req.file.buffer,
        sheetName,
        tableType: assetType as 'incidents' | 'activities',
        mapping: parsedMapping,
        dryRun: isDryRun,
        userId: req.user!.id,
      });
    } else {
      const validModes = ['skip', 'update', 'only'];
      const parsedMode = validModes.includes(req.body.duplicateMode) ? req.body.duplicateMode : 'skip';
      result = await executeImport({
        buffer: req.file.buffer,
        sheetName,
        assetType,
        mapping: parsedMapping,
        dryRun: isDryRun,
        duplicateMode: parsedMode,
      });
    }

    if (!isDryRun) {
      await audit({
        userId: req.user!.id,
        action: 'IMPORT',
        entityType: assetType,
        changes: { inserted: result.inserted, errors: result.errors.length },
        ipAddress: req.ip,
      });
    }
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
