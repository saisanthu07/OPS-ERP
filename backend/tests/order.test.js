require('./setup');
const request = require('supertest');
const app = require('../app');
const { createUser, createInventory } = require('./helpers');

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
    expect(res.body.message).toMatch(/reserve more than the available/i);
  });

  it('prevents two concurrent reservations from both succeeding beyond available stock', async () => {
    const { token: tokenA } = await createUser({ name: 'Sales A', email: 'a@test.com', role: 'SALES' });
    const { token: tokenB } = await createUser({ name: 'Sales B', email: 'b@test.com', role: 'SALES' });
    await createInventory({ physicalQty: 100, reservedQty: 0 });

    // Race condition test
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

    // Exactly one of the two must succeed (80+50=130 > 100 available). The other gets 400 or 500 (locked/timeout).
    expect(statuses[0]).toBe(201); // One succeeds
    expect(statuses[1]).toBeGreaterThanOrEqual(400); // One fails
  });
});
