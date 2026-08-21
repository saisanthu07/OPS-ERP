require('./setup');
const request = require('supertest');
const app = require('../app');
const { createUser, createInventory } = require('./helpers');

describe('Transfer Logic', () => {
  it('Test 2: Cannot transfer more than available inventory', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops1@test.com', role: 'OPERATIONS' });
    await createInventory({ physicalQty: 50, reservedQty: 0 });

    // 1. Request Transfer
    const reqRes = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceLocation: 'Warehouse-A',
        destinationLocation: 'Warehouse-B',
        item: 'Test Item',
        batch: 'BATCH-1',
        quantity: 100, // exceeds 50
      });
    expect(reqRes.status).toBe(201);
    const transferId = reqRes.body.transfer.id;

    // 2. Dispatch Transfer
    const dispatchRes = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
      
    expect(dispatchRes.status).toBe(400);
    expect(dispatchRes.body.message).toMatch(/not enough available stock/i);
  });

  it('Test 3: Destination stock increases only after transfer receipt', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops2@test.com', role: 'OPERATIONS' });
    await createInventory({ physicalQty: 50, reservedQty: 0, location: 'Warehouse-A' });

    // Request & Dispatch
    const reqRes = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceLocation: 'Warehouse-A', destinationLocation: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1', quantity: 20 });
    const transferId = reqRes.body.transfer.id;

    await request(app).post(`/api/transfers/${transferId}/dispatch`).set('Authorization', `Bearer ${token}`).send({});

    // Check inventory before receipt
    const invBefore = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token}`);
    const destBefore = invBefore.body.items.find(i => i.location === 'Warehouse-B');
    expect(destBefore).toBeUndefined(); // Or stock = 0

    // Receive
    await request(app).post(`/api/transfers/${transferId}/receive`).set('Authorization', `Bearer ${token}`).send({});

    // Check inventory after receipt
    const invAfter = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token}`);
    const destAfter = invAfter.body.items.find(i => i.location === 'Warehouse-B');
    expect(destAfter.physicalQty).toBe(20);
  });

  it('Test 4: Same transfer cannot be received twice', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops3@test.com', role: 'OPERATIONS' });
    await createInventory({ physicalQty: 50, reservedQty: 0 });

    const reqRes = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceLocation: 'Warehouse-A', destinationLocation: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1', quantity: 10 });
    const transferId = reqRes.body.transfer.id;

    await request(app).post(`/api/transfers/${transferId}/dispatch`).set('Authorization', `Bearer ${token}`).send({});

    // Receive 1st time
    const rcv1 = await request(app).post(`/api/transfers/${transferId}/receive`).set('Authorization', `Bearer ${token}`).send({});
    expect(rcv1.status).toBe(200);

    // Receive 2nd time
    const rcv2 = await request(app).post(`/api/transfers/${transferId}/receive`).set('Authorization', `Bearer ${token}`).send({});
    expect(rcv2.status).toBe(400);
    expect(rcv2.body.message).toMatch(/not in a receivable state/i);
  });
});
