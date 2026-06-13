import { Router } from 'express';
import { UserRepository } from '../repositories/userRepository.js';
import { InvoiceRepository } from '../repositories/invoiceRepository.js';

const router = Router();

router.get('/admin', async (req, res) => {
  const users = await UserRepository.getAllUsers();
  const invoices = await InvoiceRepository.getInvoices();
  const clients = await InvoiceRepository.getClients();
  
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

router.post('/admin/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  await UserRepository.updateUser(parseInt(id), { role });
  res.json({ success: true });
});

router.delete('/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  await UserRepository.deleteUser(parseInt(id));
  res.json({ success: true });
});

export { router as adminRouter };
