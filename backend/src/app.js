const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Middleware
const { releaseDbClient } = require('./middleware/releaseDbClient');
const { errorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes    = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const teamRoutes    = require('./routes/team');
const taskRoutes    = require('./routes/tasks');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhook');
const usageRoutes   = require('./routes/usage');
const notificationRoutes = require('./routes/notifications');

const app = express();

// ─────────────────────────────────────────────
// STEP 1 — Stripe webhook (MUST be before express.json())
//
// Stripe signature verification requires the raw request body bytes.
// express.json() consumes the body stream and replaces req.body with
// a parsed JS object. Once that happens the original bytes are gone
// and constructEvent() throws "No signatures found."
//
// webhookRoutes is a SEPARATE router instance from billingRoutes.
// Sharing the same router object across two app.use() mount paths
// causes Express to mis-strip the mount prefix, so express.raw()
// can fire after the body has already been touched. Dedicated router
// files eliminate that ambiguity entirely.
//
// The /webhook router applies express.raw({ type:'application/json' })
// as route-level middleware on POST /stripe only, so req.body arrives
// at constructEvent() as a Node.js Buffer — exactly what Stripe needs.
// ─────────────────────────────────────────────
app.use('/webhook', webhookRoutes);

// ─────────────────────────────────────────────
// STEP 2 — Global middleware (all non-webhook routes)
// ─────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Register DB cleanup listener before any route can open a transaction
app.use(releaseDbClient);

// ─────────────────────────────────────────────
// STEP 3 — API routes (all receive parsed JSON body)
// ─────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/team',     teamRoutes);
app.use('/api/tasks',    taskRoutes);
app.use('/api/billing',  billingRoutes);
app.use('/api/usage',    usageRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ message: 'Welcome to the Teamflow API' }));


// ─────────────────────────────────────────────
// STEP 4 — Error handler (must be last)
// ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
