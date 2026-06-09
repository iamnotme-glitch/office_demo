import { Router } from 'express';
import { AuthService } from '../services/authService.js';

const router = Router();

router.get('/login', (req, res) => {
  if (req.cookies.auth_token) {
    return res.redirect('/');
  }
  res.render('login', { pageTitle: 'Login', error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { token, user } = await AuthService.login(username, password);
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Redirect based on role
    if (user.role === 'admin') {
      res.redirect('/admin');
    } else {
      res.redirect('/');
    }
  } catch (error: any) {
    res.render('login', { pageTitle: 'Login', error: error.message });
  }
});

router.get('/admin/login', (req, res) => {
  if (req.cookies.auth_token) {
    return res.redirect('/admin');
  }
  res.render('login', { pageTitle: 'Admin Login', error: null });
});

router.get('/register', (req, res) => {
  res.render('register', { pageTitle: 'Register', error: null });
});

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    await AuthService.register(username, email, password);
    res.redirect('/login');
  } catch (error: any) {
    res.render('register', { pageTitle: 'Register', error: error.message });
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

export { router as authRouter };
