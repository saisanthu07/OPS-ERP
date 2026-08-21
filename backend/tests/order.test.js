require('./setup');
const request = require('supertest');
const createApp = require('../app');
const { createUser, createInventory } = require('./helpers');

const app = createApp();

describe('Test 1: Order reservation cannot exceed available inventory', () => {
  it('rejects a reservation larger than available quantity', async () => {
    const { token } = await createUser({ name: 'Sales', email: 'sales1@test.com', role: 'SALES' });
    await createInventory({ physicalQty: 100, reservedQty: 0 });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Acme Corp',
        item: 'Test Item',
        location: 'Warehouse-A',
        batch: 'BATCH-1',
        quantity: 150,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/available inventory/i);
  });

  it('prevents two concurrent reservations from both succeeding beyond available stock', async () => {
    const { token: tokenA } = await createUser({ name: 'Sales A', email: 'a@test.com', role: 'SALES' });
    const { token: tokenB } = await createUser({ name: 'Sales B', email: 'b@test.com', role: 'SALES' });
    await createInventory({ physicalQty: 100, reservedQty: 0 });

    const reqA = request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ customerName: 'Customer A', item: 'Test Item', location: 'Warehouse-A', batch: 'BATCH-1', quantity: 80 });

    const reqB = request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ customerName: 'Customer B', item: 'Test Item', location: 'Warehouse-A', batch: 'BATCH-1', quantity: 50 });

    const [resA, resB] = await Promise.all([reqA, reqB]);
    const statuses = [resA.status, resB.status].sort();

    // Exactly one of the two must succeed (80+50=130 > 100 available)
    expect(statuses).toEqual([201, 400]);
  });

  it('allows cancelling a reserved order and releases the reservation', async () => {
    const { token } = await createUser({ name: 'Sales', email: 'sales2@test.com', role: 'SALES' });
    await createInventory({ physicalQty: 100, reservedQty: 0 });

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerName: 'Acme', item: 'Test Item', location: 'Warehouse-A', batch: 'BATCH-1', quantity: 40 });
    expect(createRes.status).toBe(201);

    const invAfterReserve = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${token}`);
    expect(invAfterReserve.body.items[0].reservedQty).toBe(40);

    const cancelRes = await request(app)
      .post(`/api/orders/${createRes.body.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.order.status).toBe('CANCELLED');

    const invAfterCancel = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${token}`);
    expect(invAfterCancel.body.items[0].reservedQty).toBe(0);
  });
});
