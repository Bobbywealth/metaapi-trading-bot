import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // Demo user validation
  if (email === 'demo@aitrading.com' && password === 'demo123') {
    const token = jwt.sign({ userId: '1', email }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: '1', email, name: 'Demo User' } });
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
});

router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  
  // Demo registration
  const token = jwt.sign({ userId: '1', email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: '1', email, name } });
});

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    res.json({ id: decoded.userId, email: decoded.email, name: 'Demo User' });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export { router as authRouter };
