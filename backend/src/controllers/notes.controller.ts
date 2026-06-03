import { Router, Response } from 'express';
import db from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const notesRouter = Router();
notesRouter.use(authMiddleware);

// GET /api/notes — all notes, newest first, with creator name
notesRouter.get('/', async (_req: AuthRequest, res: Response) => {
  const notes = await db('notes as n')
    .join('users as u', 'n.created_by_user_id', 'u.id')
    .select('n.*', 'u.full_name as created_by_name')
    .orderBy('n.created_at', 'desc');
  res.json(notes);
});

// POST /api/notes — create a note
notesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { date, description } = req.body as { date: string; description: string };
  if (!date || !description?.trim()) {
    res.status(400).json({ error: 'date and description are required' });
    return;
  }
  const [id] = await db('notes').insert({
    date,
    description: description.trim(),
    created_by_user_id: req.user!.id,
  });
  const note = await db('notes as n')
    .join('users as u', 'n.created_by_user_id', 'u.id')
    .select('n.*', 'u.full_name as created_by_name')
    .where('n.id', id)
    .first();
  res.status(201).json(note);
});

// DELETE /api/notes/:id — only creator or superadmin can delete
notesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const note = await db('notes').where('id', req.params.id).first();
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  const isSuperAdmin = req.user!.role === 'superadmin';
  if (!isSuperAdmin && note.created_by_user_id !== req.user!.id) {
    res.status(403).json({ error: 'You can only delete your own notes' });
    return;
  }
  await db('notes').where('id', req.params.id).delete();
  res.json({ success: true });
});
