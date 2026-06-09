import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.redirect('/login');
  }

  const decoded = AuthService.verifyToken(token);
  if (!decoded) {
    res.clearCookie('auth_token');
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.redirect('/login');
  }

  (req as any).user = decoded;
  res.locals.user = decoded;
  next();
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.status(403).render('error', { message: 'You do not have permission to access this page' });
    }
    next();
  };
};
