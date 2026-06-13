import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cookieParser from 'cookie-parser';
import { invoiceRouter } from './routes/invoiceRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'views'));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.locals.user = null;
  next();
});

app.use('/', invoiceRouter);
app.use('/', adminRouter);

export default app;
