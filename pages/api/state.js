import { getDb } from '../../lib/mongodb';

const DOC_ID = 'main'; // single-user app — one document holds everything

export default async function handler(req, res) {
  try {
    const db = await getDb();
    const col = db.collection('state');

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: DOC_ID });
      return res.status(200).json(doc || {});
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: 'Missing key' });
      await col.updateOne(
        { _id: DOC_ID },
        { $set: { [key]: value, updatedAt: new Date() } },
        { upsert: true }
      );
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
