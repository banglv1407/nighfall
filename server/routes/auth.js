import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByUsername, getUserById, HAIR_STYLES, HAIR_COLORS } from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nightfall-secret-change-in-prod';
const JWT_EXPIRES = '7d';

function formatUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: !!user.is_admin,
    gender: user.gender,
    hairStyle: user.hair_style,
    hairColor: user.hair_color,
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, gender, hairStyle, hairColor } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (username.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'That username is reserved' });
    }

    const validStyles = HAIR_STYLES.map(s => s.id);
    const validColors = HAIR_COLORS.map(c => c.id);
    const finalGender = ['male', 'female', 'neutral'].includes(gender) ? gender : 'male';
    const finalHairStyle = validStyles.includes(hairStyle) ? hairStyle : 'short';
    const finalHairColor = validColors.includes(hairColor) ? hairColor : '#1a1a1a';

    const hash = await bcrypt.hash(password, 10);
    const userId = createUser(username, email || null, hash, {
      gender: finalGender,
      hairStyle: finalHairStyle,
      hairColor: finalHairColor,
    });

    const user = getUserById(userId);
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    res.status(201).json({ token, user: formatUser(user) });
  } catch (e) {
    if (e.message.includes('already taken')) {
      return res.status(409).json({ error: e.message });
    }
    console.error('Register error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    res.json({ token, user: formatUser(user) });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    const user = getUserById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: formatUser(user) });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /api/auth/config — send hair styles/colors to client
router.get('/config', (req, res) => {
  res.json({
    hairStyles: HAIR_STYLES,
    hairColors: HAIR_COLORS,
  });
});

export default router;
