import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cookieParser from 'cookie-parser';
import { invoiceRouter } from './routes/invoiceRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
// import { authenticate } from './middleware/auth.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'views'));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/', authRouter);
// app.use('/', authenticate, invoiceRouter);
app.use('/', invoiceRouter);
// app.use('/', authenticate, adminRouter);
app.use('/', adminRouter);

export default app;
