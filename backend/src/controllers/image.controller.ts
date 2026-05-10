import { Request, Response } from 'express';
import { getProxiedImage, normalizeExternalImageUrl } from '../services/image-proxy.service';

export async function proxyImage(req: Request, res: Response) {
  const raw = req.query.u;
  if (typeof raw !== 'string') {
    return res.status(400).json({ message: 'Query parameter u is required' });
  }
  const normalized = normalizeExternalImageUrl(raw);
  if (!normalized || normalized.startsWith('/api/images/proxy?u=')) {
    return res.status(400).json({ message: 'Invalid image URL' });
  }

  try {
    const result = await getProxiedImage(normalized);
    if (result.status !== 200) {
      return res.status(result.status).send(result.body);
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    return res.status(200).send(result.body);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ message: 'Image proxy failed' });
  }
}
