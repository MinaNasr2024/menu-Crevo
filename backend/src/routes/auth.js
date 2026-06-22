import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/password.js';
import { sendOk, sendError } from '../lib/http.js';
import { issueAdminToken } from '../middleware/adminAuth.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);

    const adminUsername = process.env.ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
    if (payload.username === adminUsername && payload.password === adminPassword) {
      return sendOk(res, {
        token: issueAdminToken({ role: 'admin', type: 'admin', username: adminUsername }),
        user: {
          username: payload.username,
          role: 'admin',
          type: 'admin'
        }
      });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        isActive: true,
        OR: [
          { phone: payload.username },
          { email: payload.username },
          { fullName: payload.username }
        ]
      }
    });

    if (!employee) {
      return sendError(res, 401, 'Invalid credentials');
    }

    const ok = await verifyPassword(payload.password, employee.passwordHash);
    if (!ok) {
      return sendError(res, 401, 'Invalid credentials');
    }

    sendOk(res, {
      token: issueAdminToken({
        role: employee.role === 'cashier' ? 'seller' : employee.role,
        type: 'employee',
        employeeId: employee.id,
        username: employee.phone ?? employee.email ?? employee.fullName
      }),
      user: {
        username: employee.phone ?? employee.email ?? employee.fullName,
        role: employee.role === 'cashier' ? 'seller' : employee.role,
        type: 'employee',
        employeeId: employee.id
      }
    });
  } catch (error) {
    next(error);
  }
});
