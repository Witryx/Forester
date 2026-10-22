import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { audit, transaction, type Db } from './db';
import { hashPassword, verifyPassword, randomToken, tokenHash } from './security';
import { DomainError } from './planning';
import type { User } from '../shared/types';
z.config(z.locales.cs());
declare global {
  namespace Express {
    interface Request {
      user: User;
      tokenHash: string;
      csrfToken: string;
      correlationId: string;
    }
  }
}
const userColumns = 'id,username,role,active,employee_id,display_name,must_change_password,version';
const loginInput = z.object({
  username: z.string().trim().toLowerCase().min(1).max(40),
  password: z.string().min(1).max(128),
});
const passwordInput = z.string().min(12, 'Heslo musí mít alespoň 12 znaků.').max(128);
const usernameInput = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, 'Uživatelské jméno: 3–40 znaků a-z, 0-9, tečka, pomlčka.');
const displayNameInput = z.string().trim().min(2).max(80);
const accountInput = z
  .object({
    username: usernameInput,
    displayName: displayNameInput,
    role: z.enum(['dispatcher', 'driver']),
    employeeId: z.string().min(1).nullable(),
    newEmployee: z
      .object({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
      })
      .optional(),
    password: passwordInput,
  })
  .refine((v) => v.role !== 'driver' || !!v.employeeId !== !!v.newEmployee, {
    message: 'Vyberte existujícího zaměstnance, nebo vytvořte nového.',
    path: ['employeeId'],
  })
  .refine((v) => v.role === 'driver' || !v.newEmployee, {
    message: 'Nový profil zaměstnance lze vytvořit pro řidičský účet.',
    path: ['newEmployee'],
  });
export function createApp(db: Db, options: { origin?: string; production?: boolean } = {}) {
  const app = express();
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const origin = options.origin || process.env.APP_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = new Set([
    origin,
    ...(!production
      ? [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
        ]
      : []),
  ]);
  if (
    production &&
    (!origin.startsWith('https://') ||
      db.prepare("SELECT key FROM settings WHERE key='demo'").get())
  )
    throw new Error('Produkce vyžaduje HTTPS APP_ORIGIN a databázi bez demo dat.');
  const hours = Number(process.env.SESSION_HOURS || 12);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168)
    throw new Error('SESSION_HOURS musí být 0–168 hodin.');
  const dummyPassword = hashPassword(randomToken());
  const attempts = new Map<string, { count: number; until: number }>();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    req.correlationId = randomUUID();
    res.setHeader('X-Request-Id', req.correlationId);
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!req.headers.origin || !allowedOrigins.has(req.headers.origin))
    )
      return next(new DomainError(403, 'Požadavek pochází z nepovoleného zdroje.'));
    next();
  });
  const setCookie = (res: Response, token: string, maxAge: number) =>
    res.cookie('forester_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: production,
      path: '/',
      maxAge,
    });
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = loginInput.parse(req.body);
    const ip = req.ip || 'unknown';
    const now = Date.now();
    for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
    const bucket = attempts.get(ip) || { count: 0, until: now + 15 * 60_000 };
    if (bucket.count >= 10)
      throw new DomainError(429, 'Příliš mnoho pokusů. Zkuste to za 15 minut.');
    bucket.count++;
    attempts.set(ip, bucket);
    const row = db
      .prepare(`SELECT ${userColumns},password_hash,session_version FROM users WHERE username=?`)
      .get(input.username);
    const valid = await verifyPassword(
      input.password,
      (row?.password_hash as string) || (await dummyPassword),
    );
    if (!valid || !row?.active)
      throw new DomainError(401, 'Uživatelské jméno nebo heslo není správné.');
    // Re-read after asynchronous hashing: an intervening deactivation/reset must win.
    const current = db
      .prepare(`SELECT ${userColumns},password_hash,session_version FROM users WHERE id=?`)
      .get(row.id);
    if (
      !current?.active ||
      current.password_hash !== row.password_hash ||
      current.session_version !== row.session_version
    )
      throw new DomainError(401, 'Uživatelské jméno nebo heslo není správné.');
    attempts.delete(ip);
    const token = randomToken();
    const csrf = randomToken();
    transaction(db, () => {
      const latest = db
        .prepare('SELECT active,session_version,password_hash FROM users WHERE id=?')
        .get(current.id);
      if (
        !latest?.active ||
        latest.password_hash !== current.password_hash ||
        latest.session_version !== current.session_version
      )
        throw new DomainError(401, 'Uživatelské jméno nebo heslo není správné.');
      db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
      db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run(
        tokenHash(token),
        current.id,
        csrf,
        current.session_version,
        now + hours * 3600_000,
        now,
      );
      audit(
        db,
        { id: current.id as string, username: current.username as string },
        'auth.login',
        'user',
        current.id as string,
        null,
        null,
        req.correlationId,
      );
    });
    setCookie(res, token, hours * 3600_000);
    res.json({ ok: true });
  });
  app.use('/api', (req, _res, next) => {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('forester_session='))
      ?.slice('forester_session='.length);
    if (!cookie || !/^[a-f0-9]{64}$/.test(cookie))
      return next(new DomainError(401, 'Přihlaste se prosím znovu.'));
    req.tokenHash = tokenHash(cookie);
    const session = db
      .prepare(
        `SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.session_version=s.session_version`,
      )
      .get(req.tokenHash, Date.now());
    if (!session) return next(new DomainError(401, 'Přihlaste se prosím znovu.'));
    req.user = Object.fromEntries(
      userColumns.split(',').map((k) => [k, session[k]]),
    ) as unknown as User;
    req.csrfToken = session.csrf_token as string;
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers['x-csrf-token'] !== req.csrfToken
    )
      return next(new DomainError(403, 'Platnost formuláře vypršela. Obnovte stránku.'));
    if (
      req.user.must_change_password &&
      !['/auth/password', '/auth/logout', '/bootstrap'].includes(req.path)
    )
      return next(new DomainError(403, 'Nejdříve změňte dočasné heslo.'));
    next();
  });
  const dispatcher = (req: Request, _res: Response, next: NextFunction) =>
    req.user.role === 'dispatcher'
      ? next()
      : next(new DomainError(403, 'Tato část je dostupná pouze dispečerovi.'));
  const reauthorize = (req: Request, admin = false) => {
    const session = db
      .prepare(
        'SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.session_version=s.session_version',
      )
      .get(req.tokenHash, Date.now());
    if (!session) throw new DomainError(401, 'Přihlaste se prosím znovu.');
    if (admin && session.role !== 'dispatcher')
      throw new DomainError(403, 'Tato část je dostupná pouze dispečerovi.');
  };
  app.post('/api/auth/logout', (req, res) => {
    transaction(db, () => {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.tokenHash);
      audit(db, req.user, 'auth.logout', 'user', req.user.id, null, null, req.correlationId);
    });
    setCookie(res, '', 0);
    res.json({ ok: true });
  });
  app.post('/api/auth/password', async (req, res) => {
    const input = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: passwordInput,
      })
      .parse(req.body);
    if (input.currentPassword === input.newPassword)
      throw new DomainError(422, 'Nové heslo musí být jiné než současné.');
    const row = db.prepare('SELECT password_hash,version FROM users WHERE id=?').get(req.user.id)!;
    if (!(await verifyPassword(input.currentPassword, row.password_hash as string)))
      throw new DomainError(422, 'Současné heslo není správné.');
    const encoded = await hashPassword(input.newPassword);
    transaction(db, () => {
      reauthorize(req);
      const result = db
        .prepare(
          'UPDATE users SET password_hash=?,must_change_password=0,session_version=session_version+1,version=version+1 WHERE id=? AND password_hash=? AND active=1',
        )
        .run(encoded, req.user.id, row.password_hash);
      if (!result.changes)
        throw new DomainError(409, 'Účet se mezitím změnil. Přihlaste se znovu.');
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.user.id);
      audit(
        db,
        req.user,
        'user.password_changed',
        'user',
        req.user.id,
        null,
        { sessionsRevoked: true },
        req.correlationId,
      );
    });
    setCookie(res, '', 0);
    res.json({ ok: true });
  });
  app.get('/api/bootstrap', (req, res) => {
    const employees =
      req.user.role === 'dispatcher' && !req.user.must_change_password
        ? db
            .prepare(
              'SELECT id,code,first_name,last_name,active FROM employees WHERE archived_at IS NULL ORDER BY last_name',
            )
            .all()
        : [];
    res.json({
      user: req.user,
      csrfToken: req.csrfToken,
      demo: !!db.prepare("SELECT key FROM settings WHERE key='demo'").get(),
      employees,
      fetchedAt: Date.now(),
    });
  });
  app.get('/api/users', dispatcher, (_req, res) =>
    res.json(db.prepare(`SELECT ${userColumns} FROM users ORDER BY role,username`).all()),
  );
  app.post('/api/users', dispatcher, async (req, res) => {
    const input = accountInput.parse(req.body);
    const encoded = await hashPassword(input.password);
    const id = randomUUID();
    transaction(db, () => {
      reauthorize(req, true);
      let employeeId = input.role === 'driver' ? input.employeeId : null;
      if (input.newEmployee) {
        employeeId = randomUUID();
        const highestCode = db
          .prepare('SELECT code FROM employees')
          .all()
          .reduce((max, row) => {
            const match = /^ZAM-(\d+)$/.exec(row.code as string);
            return match ? Math.max(max, Number(match[1])) : max;
          }, 0);
        const code = `ZAM-${String(highestCode + 1).padStart(3, '0')}`;
        db.prepare('INSERT INTO employees (id,code,first_name,last_name) VALUES (?,?,?,?)').run(
          employeeId,
          code,
          input.newEmployee.firstName,
          input.newEmployee.lastName,
        );
        audit(
          db,
          req.user,
          'employee.created',
          'employee',
          employeeId,
          null,
          { code, first_name: input.newEmployee.firstName, last_name: input.newEmployee.lastName },
          req.correlationId,
        );
      }
      if (
        input.role === 'driver' &&
        !db
          .prepare('SELECT id FROM employees WHERE id=? AND active=1 AND archived_at IS NULL')
          .get(employeeId)
      )
        throw new DomainError(422, 'Vyberte aktivního zaměstnance.');
      db.prepare(
        'INSERT INTO users (id,username,password_hash,role,display_name,employee_id,must_change_password) VALUES (?,?,?,?,?,?,1)',
      ).run(id, input.username, encoded, input.role, input.displayName, employeeId);
      audit(
        db,
        req.user,
        'user.created',
        'user',
        id,
        null,
        {
          username: input.username,
          role: input.role,
          displayName: input.displayName,
          employeeId,
        },
        req.correlationId,
      );
    });
    res.status(201).json({ id });
  });
  app.patch('/api/users/:id', dispatcher, (req, res) => {
    const input = z
      .object({
        username: usernameInput,
        displayName: displayNameInput,
        active: z.boolean(),
        role: z.enum(['dispatcher', 'driver']),
        employeeId: z.string().min(1).nullable(),
        version: z.number().int().positive(),
      })
      .parse(req.body);
    transaction(db, () => {
      reauthorize(req, true);
      const old = db
        .prepare(`SELECT ${userColumns} FROM users WHERE id=?`)
        .get(req.params.id as string);
      if (!old) throw new DomainError(404, 'Účet nebyl nalezen.');
      if (old.version !== input.version)
        throw new DomainError(409, 'Účet mezitím upravil jiný dispečer. Načtěte aktuální stav.');
      if (
        old.role === 'dispatcher' &&
        old.active &&
        (!input.active || input.role !== 'dispatcher') &&
        Number(
          db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='dispatcher' AND active=1").get()!
            .n,
        ) <= 1
      )
        throw new DomainError(422, 'Poslední aktivní dispečer musí zůstat zachovaný.');
      if (
        input.role === 'driver' &&
        (!input.employeeId ||
          !db
            .prepare('SELECT id FROM employees WHERE id=? AND active=1 AND archived_at IS NULL')
            .get(input.employeeId))
      )
        throw new DomainError(422, 'Řidič musí být propojen s aktivním zaměstnancem.');
      db.prepare(
        'UPDATE users SET username=?,display_name=?,active=?,role=?,employee_id=?,version=version+1,session_version=session_version+1 WHERE id=?',
      ).run(
        input.username,
        input.displayName,
        +input.active,
        input.role,
        input.role === 'driver' ? input.employeeId : null,
        old.id,
      );
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(old.id);
      audit(
        db,
        req.user,
        'user.updated',
        'user',
        old.id as string,
        old,
        {
          username: input.username,
          display_name: input.displayName,
          active: +input.active,
          role: input.role,
          employee_id: input.role === 'driver' ? input.employeeId : null,
          version: input.version + 1,
        },
        req.correlationId,
      );
    });
    res.json({ ok: true });
  });
  app.post('/api/users/:id/reset-password', dispatcher, async (req, res) => {
    const input = z
      .object({ password: passwordInput, version: z.number().int().positive() })
      .parse(req.body);
    const encoded = await hashPassword(input.password);
    transaction(db, () => {
      reauthorize(req, true);
      if (!db.prepare('SELECT id FROM users WHERE id=?').get(req.params.id as string))
        throw new DomainError(404, 'Účet nebyl nalezen.');
      const result = db
        .prepare(
          'UPDATE users SET password_hash=?,must_change_password=1,session_version=session_version+1,version=version+1 WHERE id=? AND version=?',
        )
        .run(encoded, req.params.id as string, input.version);
      if (!result.changes)
        throw new DomainError(409, 'Účet se mezitím změnil. Načtěte aktuální stav.');
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id as string);
      audit(
        db,
        req.user,
        'user.password_reset',
        'user',
        req.params.id as string,
        null,
        { mustChangePassword: true, sessionsRevoked: true },
        req.correlationId,
      );
    });
    res.json({ ok: true });
  });
  app.use('/api', (_req, _res, next) =>
    next(new DomainError(404, 'Tento požadavek není dostupný.')),
  );
  const dist = resolve('dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError)
      return res.status(422).json({
        message: 'Zkontrolujte údaje formuláře.',
        fields: error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    if (error instanceof DomainError)
      return res.status(error.status).json({ message: error.message });
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint'))
      return res.status(409).json({ message: 'Uživatelské jméno nebo profil už je použitý.' });
    if (message.includes('reservation_conflict'))
      return res.status(409).json({ message: 'Souprava je v tomto čase již rezervovaná.' });
    if (message.includes('JSON') || (error as { status?: number })?.status === 400)
      return res.status(400).json({ message: 'Požadavek nemá platný formát.' });
    console.error(`Request ${req.correlationId}: internal error`);
    res.status(500).json({
      message: 'Požadavek se nepodařilo dokončit. Zkuste to znovu.',
      requestId: req.correlationId,
    });
  });
  return app;
}
