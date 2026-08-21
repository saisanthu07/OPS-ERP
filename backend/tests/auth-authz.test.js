require('./setup');
const request = require('supertest');
const createApp = require('../app');
const { createUser, createInventory } = require('./helpers');

const app = createApp();

describe('Test 5: Unauthorized user cannot perform restricted operation', () => {
  it('rejects a Sales user attempting to create a Work Order (Admin-only)', async () => {
    const { token: salesToken } = await createUser({ name: 'Sales', email: 'sales@test.com', role: 'SALES' });
    const { user: opsUser } = await createUser({ name: 'Ops', email: 'ops@test.com', role: 'OPERATIONS' });
    await createInventory({ item: 'WidgetX', location: 'Warehouse-A' });

    const res = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ location: 'Warehouse-A', item: 'WidgetX', requiredQty: 10, assignedUser: opsUser._id });

    expect(res.status).toBe(403);
  });

  it('rejects an Operations user attempting to reserve stock via /orders (Sales/Admin-only)', async () => {
    const { token: opsToken } = await createUser({ name: 'Ops', email: 'ops2@test.com', role: 'OPERATIONS' });
    await createInventory({ item: 'WidgetY', location: 'Warehouse-A' });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ customerName: 'X', item: 'WidgetY', location: 'Warehouse-A', batch: 'BATCH-1', quantity: 1 });

    expect(res.status).toBe(403);
  });

  it('rejects requests with no token at all', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a tampered/invalid token', async () => {
    const res = await request(app).get('/api/inventory').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('Login flow', () => {
  it('rejects login with wrong password', async () => {
    await createUser({ name: 'A', email: 'login1@test.com', role: 'ADMIN', password: 'CorrectPass123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login1@test.com', password: 'WrongPass' });
    expect(res.status).toBe(401);
  });

  it('logs in successfully with correct credentials and returns an access token', async () => {
    await createUser({ name: 'A', email: 'login2@test.com', role: 'ADMIN', password: 'CorrectPass123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login2@test.com', password: 'CorrectPass123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});
