import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { invoiceRouter } from './routes/invoiceRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { InvoiceRepository } from './repositories/invoiceRepository.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'views'));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const VISITOR_DATA_TTL_HOURS = Number(process.env.VISITOR_DATA_TTL_HOURS || '6');
const VISITOR_DATA_TTL_MS = VISITOR_DATA_TTL_HOURS * 60 * 60 * 1000;

app.use((req, res, next) => {
  let visitorId = req.cookies?.visitor_id as string | undefined;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    res.cookie('visitor_id', visitorId, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  res.locals.visitorId = visitorId;
  InvoiceRepository.cleanupExpiredVisitorData(VISITOR_DATA_TTL_MS);
  res.locals.user = null;
  next();
});

app.use('/', invoiceRouter);
app.use('/', adminRouter);

export default app;
