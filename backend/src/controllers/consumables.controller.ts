import { Router, Response } from 'express';
import db from '../config/db';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';
import { audit } from '../services/audit.service';

export const consumablesRouter = Router();
consumablesRouter.use(authMiddleware);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getItem(id: number) {
  return db('consumable_items as ci')
    .leftJoin('vendors as v', 'ci.vendor_id', 'v.id')
    .leftJoin('locations as l', 'ci.location_id', 'l.id')
    .select(
      'ci.*',
      'v.name as vendor_name',
      'l.name as location_name',
    )
    .where('ci.id', id)
    .first();
}

// ─── List ────────────────────────────────────────────────────────────────────

consumablesRouter.get('/', requirePermission('consumables_view'), async (req: AuthRequest, res: Response) => {
  const {
    page = '1',
    pageSize = '100',
    search,
    sortBy = 'name',
    sortDir = 'asc',
    includeDeleted,
    category,
  } = req.query as Record<string, string>;

  const p = Math.max(1, parseInt(page, 10));
  const ps = Math.min(500, Math.max(1, parseInt(pageSize, 10)));

  let query = db('consumable_items as ci')
    .leftJoin('vendors as v', 'ci.vendor_id', 'v.id')
    .leftJoin('locations as l', 'ci.location_id', 'l.id')
    .select(
      'ci.*',
      'v.name as vendor_name',
      'l.name as location_name',
    );

  if (includeDeleted !== 'true') {
    query = query.whereNull('ci.deleted_at');
  }
  if (search) {
    query = query.where((b) =>
      b.whereILike('ci.name', `%${search}%`)
       .orWhereILike('ci.category', `%${search}%`)
       .orWhereILike('ci.description', `%${search}%`),
    );
  }
  if (category) {
    query = query.whereILike('ci.category', `%${category}%`);
  }

  const allowedSort: Record<string, string> = {
    name: 'ci.name',
    category: 'ci.category',
    current_stock: 'ci.current_stock',
    minimum_stock: 'ci.minimum_stock',
    location_id: 'l.name',
    vendor_id: 'v.name',
    created_at: 'ci.created_at',
    updated_at: 'ci.updated_at',
  };
  const orderCol = allowedSort[sortBy] ?? 'ci.name';
  const orderDir = sortDir === 'desc' ? 'desc' : 'asc';

  const countQuery = query.clone().clearSelect().clearOrder().count('ci.id as total').first() as any;
  const [{ total }] = await Promise.all([countQuery]);

  const rows = await query
    .orderBy(orderCol, orderDir)
    .limit(ps)
    .offset((p - 1) * ps);

  res.json({
    data: rows,
    pagination: {
      page: p,
      pageSize: ps,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / ps),
    },
  });
});

// ─── Get single ──────────────────────────────────────────────────────────────

consumablesRouter.get('/:id', requirePermission('consumables_view'), async (req: AuthRequest, res: Response) => {
  const item = await getItem(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// ─── Create ──────────────────────────────────────────────────────────────────

consumablesRouter.post('/', requirePermission('consumables_create'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, category, description, vendor_id, location_id,
      unit, minimum_stock, remarks,
      initial_stock, initial_stock_date, initial_stock_reference,
      initial_po_number, initial_invoice_number,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const initialQty = initial_stock ? Number(initial_stock) : 0;
    let newId!: number;

    await db.transaction(async (trx) => {
      const [id] = await trx('consumable_items').insert({
        name: name.trim(),
        category: category?.trim() || null,
        description: description?.trim() || null,
        vendor_id: vendor_id || null,
        location_id: location_id || null,
        unit: unit?.trim() || 'each',
        current_stock: initialQty,
        minimum_stock: minimum_stock != null ? Number(minimum_stock) : null,
        remarks: remarks?.trim() || null,
      });
      newId = id;

      if (initialQty > 0) {
        await trx('consumable_transactions').insert({
          consumable_item_id: id,
          transaction_type: 'stock_in',
          quantity: initialQty,
          employee_id: null,
          performed_by_user_id: req.user!.id,
          transaction_date: initial_stock_date || new Date().toISOString().slice(0, 10),
          reference_number: initial_stock_reference?.trim() || null,
          po_number: initial_po_number?.trim() || null,
          invoice_number: initial_invoice_number?.trim() || null,
          notes: 'Opening stock',
        });
      }
    });

    await audit({
      userId: req.user!.id,
      action: 'CREATE',
      entityType: 'consumable_item',
      entityId: newId,
      changes: req.body,
      ipAddress: req.ip,
    });

    const item = await getItem(newId);
    res.status(201).json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Update ──────────────────────────────────────────────────────────────────

consumablesRouter.put('/:id', requirePermission('consumables_edit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      name, category, description, vendor_id, location_id,
      unit, minimum_stock, remarks,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    await db('consumable_items').where({ id }).update({
      name: name.trim(),
      category: category?.trim() || null,
      description: description?.trim() || null,
      vendor_id: vendor_id || null,
      location_id: location_id || null,
      unit: unit?.trim() || 'each',
      minimum_stock: minimum_stock != null ? Number(minimum_stock) : null,
      remarks: remarks?.trim() || null,
      updated_at: db.fn.now(),
    });

    await audit({
      userId: req.user!.id,
      action: 'UPDATE',
      entityType: 'consumable_item',
      entityId: id,
      changes: req.body,
      ipAddress: req.ip,
    });

    const item = await getItem(id);
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Soft delete ─────────────────────────────────────────────────────────────

consumablesRouter.delete('/:id', requirePermission('consumables_delete'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db('consumable_items').where({ id }).update({ deleted_at: db.fn.now() });
  await audit({
    userId: req.user!.id,
    action: 'DELETE',
    entityType: 'consumable_item',
    entityId: id,
    ipAddress: req.ip,
  });
  res.json({ success: true });
});

// ─── Restore ─────────────────────────────────────────────────────────────────

consumablesRouter.post('/:id/restore', requirePermission('consumables_edit'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db('consumable_items').where({ id }).update({ deleted_at: null, updated_at: db.fn.now() });
  await audit({
    userId: req.user!.id,
    action: 'RESTORE',
    entityType: 'consumable_item',
    entityId: id,
    ipAddress: req.ip,
  });
  res.json({ success: true });
});

// ─── Stock In ────────────────────────────────────────────────────────────────

consumablesRouter.post('/:id/stock-in', requirePermission('consumables_edit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { quantity, reference_number, po_number, invoice_number, notes, transaction_date } = req.body;

    const qty = Number(quantity);
    if (!qty || qty < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });

    await db.transaction(async (trx) => {
      await trx('consumable_transactions').insert({
        consumable_item_id: id,
        transaction_type: 'stock_in',
        quantity: qty,
        employee_id: null,
        performed_by_user_id: req.user!.id,
        transaction_date: transaction_date || new Date().toISOString().slice(0, 10),
        reference_number: reference_number?.trim() || null,
        po_number: po_number?.trim() || null,
        invoice_number: invoice_number?.trim() || null,
        notes: notes?.trim() || null,
      });

      await trx('consumable_items').where({ id })
        .increment('current_stock', qty)
        .update({ updated_at: db.fn.now() });
    });

    await audit({
      userId: req.user!.id,
      action: 'UPDATE',
      entityType: 'consumable_item',
      entityId: id,
      changes: { transaction_type: 'stock_in', quantity: qty, po_number, invoice_number, reference_number },
      ipAddress: req.ip,
    });

    const item = await getItem(id);
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Assign to Employee ──────────────────────────────────────────────────────

consumablesRouter.post('/:id/assign', requirePermission('consumables_edit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { quantity, employee_id, notes, transaction_date } = req.body;

    const qty = Number(quantity);
    if (!qty || qty < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });
    if (!employee_id) return res.status(400).json({ error: 'Employee is required' });

    await db.transaction(async (trx) => {
      const item = await trx('consumable_items').where({ id }).first();
      if (!item) throw new Error('Item not found');
      if (item.current_stock < qty) {
        throw new Error(`Insufficient stock. Available: ${item.current_stock}`);
      }

      await trx('consumable_transactions').insert({
        consumable_item_id: id,
        transaction_type: 'assigned',
        quantity: qty,
        employee_id: Number(employee_id),
        performed_by_user_id: req.user!.id,
        transaction_date: transaction_date || new Date().toISOString().slice(0, 10),
        reference_number: null,
        notes: notes?.trim() || null,
      });

      await trx('consumable_items').where({ id })
        .decrement('current_stock', qty)
        .update({ updated_at: db.fn.now() });
    });

    await audit({
      userId: req.user!.id,
      action: 'UPDATE',
      entityType: 'consumable_item',
      entityId: id,
      changes: { transaction_type: 'assigned', quantity: qty, employee_id },
      ipAddress: req.ip,
    });

    const item = await getItem(id);
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Return from Employee ────────────────────────────────────────────────────

consumablesRouter.post('/:id/return', requirePermission('consumables_edit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { quantity, employee_id, notes, transaction_date } = req.body;

    const qty = Number(quantity);
    if (!qty || qty < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });
    if (!employee_id) return res.status(400).json({ error: 'Employee is required' });

    await db.transaction(async (trx) => {
      await trx('consumable_transactions').insert({
        consumable_item_id: id,
        transaction_type: 'returned',
        quantity: qty,
        employee_id: Number(employee_id),
        performed_by_user_id: req.user!.id,
        transaction_date: transaction_date || new Date().toISOString().slice(0, 10),
        reference_number: null,
        notes: notes?.trim() || null,
      });

      await trx('consumable_items').where({ id })
        .increment('current_stock', qty)
        .update({ updated_at: db.fn.now() });
    });

    await audit({
      userId: req.user!.id,
      action: 'UPDATE',
      entityType: 'consumable_item',
      entityId: id,
      changes: { transaction_type: 'returned', quantity: qty, employee_id },
      ipAddress: req.ip,
    });

    const item = await getItem(id);
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Transaction History ─────────────────────────────────────────────────────

consumablesRouter.get('/:id/transactions', requirePermission('consumables_view'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db('consumable_transactions as ct')
    .leftJoin('employees as e', 'ct.employee_id', 'e.id')
    .leftJoin('users as u', 'ct.performed_by_user_id', 'u.id')
    .select(
      'ct.*',
      'e.full_name as employee_name',
      'e.employee_code',
      'u.username as performed_by_username',
    )
    .where('ct.consumable_item_id', id)
    .orderBy('ct.created_at', 'desc');
  res.json(rows);
});

// ─── Current Assignments (who holds what) ────────────────────────────────────

consumablesRouter.get('/:id/assignments', requirePermission('consumables_view'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);

  // Net quantity per employee = assigned - returned
  const rows = await db('consumable_transactions as ct')
    .join('employees as e', 'ct.employee_id', 'e.id')
    .select(
      'e.id as employee_id',
      'e.full_name as employee_name',
      'e.employee_code',
      db.raw(`SUM(CASE WHEN ct.transaction_type = 'assigned' THEN ct.quantity ELSE 0 END) as total_assigned`),
      db.raw(`SUM(CASE WHEN ct.transaction_type = 'returned' THEN ct.quantity ELSE 0 END) as total_returned`),
      db.raw(`SUM(CASE WHEN ct.transaction_type = 'assigned' THEN ct.quantity WHEN ct.transaction_type = 'returned' THEN -ct.quantity ELSE 0 END) as net_quantity`),
    )
    .where('ct.consumable_item_id', id)
    .whereIn('ct.transaction_type', ['assigned', 'returned'])
    .groupBy('e.id', 'e.full_name', 'e.employee_code')
    .having(db.raw(`SUM(CASE WHEN ct.transaction_type = 'assigned' THEN ct.quantity WHEN ct.transaction_type = 'returned' THEN -ct.quantity ELSE 0 END) > 0`));

  res.json(rows);
});

// ─── All consumables held by a specific employee ────────────────────────────

consumablesRouter.get('/employee/:employeeId', requirePermission('consumables_view'), async (req: AuthRequest, res: Response) => {
  const employeeId = Number(req.params.employeeId);

  const rows = await db('consumable_transactions as ct')
    .join('consumable_items as ci', 'ct.consumable_item_id', 'ci.id')
    .select(
      'ci.id as consumable_item_id',
      'ci.name',
      'ci.category',
      'ci.unit',
      db.raw(`SUM(CASE WHEN ct.transaction_type = 'assigned' THEN ct.quantity ELSE 0 END) as total_assigned`),
      db.raw(`SUM(CASE WHEN ct.transaction_type = 'returned' THEN ct.quantity ELSE 0 END) as total_returned`),
      db.raw(`SUM(CASE WHEN ct.transaction_type = 'assigned' THEN ct.quantity WHEN ct.transaction_type = 'returned' THEN -ct.quantity ELSE 0 END) as net_quantity`),
    )
    .where('ct.employee_id', employeeId)
    .whereIn('ct.transaction_type', ['assigned', 'returned'])
    .whereNull('ci.deleted_at')
    .groupBy('ci.id', 'ci.name', 'ci.category', 'ci.unit')
    .having(db.raw(`SUM(CASE WHEN ct.transaction_type = 'assigned' THEN ct.quantity WHEN ct.transaction_type = 'returned' THEN -ct.quantity ELSE 0 END) > 0`))
    .orderBy('ci.name', 'asc');

  res.json(rows);
});

// ─── Categories list (distinct values) ──────────────────────────────────────

consumablesRouter.get('/meta/categories', requirePermission('consumables_view'), async (_req: AuthRequest, res: Response) => {
  const rows = await db('consumable_items')
    .whereNotNull('category')
    .whereNull('deleted_at')
    .distinct('category')
    .orderBy('category', 'asc')
    .pluck('category');
  res.json(rows);
});
