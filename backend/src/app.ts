import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import {
  vendorsRouter, locationsRouter, departmentsRouter, employeesRouter, assetStatusesRouter,
} from './routes/lookups.routes';
import {
  endpointsRouter, monitorsRouter, mobileDevicesRouter, ipPhonesRouter,
  serversRouter, printersRouter, networkDevicesRouter, otherAssetsRouter,
} from './routes/assets.routes';
import { importRouter } from './controllers/import.controller';
import { incidentsRouter } from './controllers/incidents.controller';
import { auditRouter } from './controllers/audit.controller';
import { dashboardRouter } from './controllers/dashboard.controller';
import { employeeAssetsRouter } from './controllers/employee-assets.controller';
import { rolesRouter } from './controllers/roles.controller';
import { usersRouter } from './controllers/users.controller';
import { approvalsRouter } from './controllers/approvals.controller';
import { notFound, errorHandler } from './middleware/error';

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(`${env.apiPrefix}/auth`, authRoutes);
app.use(`${env.apiPrefix}/vendors`, vendorsRouter);
app.use(`${env.apiPrefix}/locations`, locationsRouter);
app.use(`${env.apiPrefix}/departments`, departmentsRouter);
app.use(`${env.apiPrefix}/employees`, employeesRouter);
app.use(`${env.apiPrefix}/asset-statuses`, assetStatusesRouter);

app.use(`${env.apiPrefix}/endpoints`, endpointsRouter);
app.use(`${env.apiPrefix}/monitors`, monitorsRouter);
app.use(`${env.apiPrefix}/mobile-devices`, mobileDevicesRouter);
app.use(`${env.apiPrefix}/ip-phones`, ipPhonesRouter);
app.use(`${env.apiPrefix}/servers`, serversRouter);
app.use(`${env.apiPrefix}/printers`, printersRouter);
app.use(`${env.apiPrefix}/network-devices`, networkDevicesRouter);
app.use(`${env.apiPrefix}/other-assets`, otherAssetsRouter);
app.use(`${env.apiPrefix}/import`, importRouter);
app.use(`${env.apiPrefix}/incidents`, incidentsRouter);
app.use(`${env.apiPrefix}/audit-logs`, auditRouter);
app.use(`${env.apiPrefix}/dashboard`, dashboardRouter);
app.use(`${env.apiPrefix}/employees`, employeeAssetsRouter);
app.use(`${env.apiPrefix}/roles`, rolesRouter);
app.use(`${env.apiPrefix}/users`, usersRouter);
app.use(`${env.apiPrefix}/approvals`, approvalsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
