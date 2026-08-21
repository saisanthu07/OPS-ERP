require('./setup');
const request = require('supertest');
const app = require('../app');
const { createUser } = require('./helpers');

describe('Test 5: Unauthorized user cannot perform restricted operation', () => {
  it('prevents SALES role from dispatching a transfer', async () => {
    // Sales role
    const { token } = await createUser({ name: 'Sales Person', email: 'sales1@test.com', role: 'SALES' });

    const res = await request(app)
      .post('/api/transfers/some-id/dispatch')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    // Should be 403 Forbidden because SALES is not in requireRole('ADMIN', 'OPERATIONS')
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/do not have permission/i);
  });
  
  it('prevents OPERATIONS role from creating customer orders', async () => {
    // Ops role
    const { token } = await createUser({ name: 'Ops Person', email: 'ops1@test.com', role: 'OPERATIONS' });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Acme',
        item: 'Test',
        location: 'Warehouse-A',
        batch: 'B1',
        quantity: 10
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/do not have permission/i);
  });
});
