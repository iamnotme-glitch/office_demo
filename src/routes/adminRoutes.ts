import { Router } from 'express';
// import { authorize } from '../middleware/auth.js';
import { UserRepository } from '../repositories/userRepository.js';
import { InvoiceRepository } from '../repositories/invoiceRepository.js';

const router = Router();

router.get('/admin', /* authorize(['admin']), */ (req, res) => {
  const users = UserRepository.getAllUsers();
  const invoices = InvoiceRepository.getInvoices();
  const clients = InvoiceRepository.getClients();
  
  res.render('admin/dashboard', {
    pageTitle: 'Admin Panel',
    currentPage: 'admin',
    users,
    stats: {
      totalUsers: users.length,
      totalInvoices: invoices.length,
      totalClients: clients.length,
      totalRevenue: invoices.reduce((sum, inv) => sum + inv.total_amount, 0)
    }
  });
});

router.post('/admin/users/:id/role', /* authorize(['admin']), */ (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  UserRepository.updateUser(parseInt(id), { role });
  res.json({ success: true });
});

router.delete('/admin/users/:id', /* authorize(['admin']), */ (req, res) => {
  const { id } = req.params;
  UserRepository.deleteUser(parseInt(id));
  res.json({ success: true });
});

export { router as adminRouter };
