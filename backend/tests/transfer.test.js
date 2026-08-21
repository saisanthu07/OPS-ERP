require('./setup');
const request = require('supertest');
const createApp = require('../app');
const Inventory = require('../models/Inventory');
const { createUser, createInventory } = require('./helpers');

const app = createApp();

describe('Test 2: Cannot transfer more than available inventory', () => {
  it('rejects a transfer request larger than available source stock', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops1@test.com', role: 'OPERATIONS' });
    await createInventory({ location: 'Warehouse-A', physicalQty: 60, reservedQty: 0 });

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceLocation: 'Warehouse-A',
        destinationLocation: 'Warehouse-B',
        item: 'Test Item',
        batch: 'BATCH-1',
        quantity: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  it('rejects dispatch if reserved stock leaves insufficient available quantity', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops2@test.com', role: 'OPERATIONS' });
    const inv = await createInventory({ location: 'Warehouse-A', physicalQty: 100, reservedQty: 90 });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceLocation: 'Warehouse-A',
        destinationLocation: 'Warehouse-B',
        item: 'Test Item',
        batch: 'BATCH-1',
        quantity: 5,
      });
    expect(createRes.status).toBe(201);

    // Reserve almost everything else in between (simulating a race with a sales reservation)
    inv.reservedQty = 98;
    await inv.save();

    const dispatchRes = await request(app)
      .post(`/api/transfers/${createRes.body.transfer._id}/dispatch`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(dispatchRes.status).toBe(400);
  });
});

describe('Test 3: Destination stock increases only after transfer receipt', () => {
  it('does not increase destination inventory on dispatch, only on receipt', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops3@test.com', role: 'OPERATIONS' });
    await createInventory({ location: 'Warehouse-A', physicalQty: 100, reservedQty: 0 });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceLocation: 'Warehouse-A',
        destinationLocation: 'Warehouse-B',
        item: 'Test Item',
        batch: 'BATCH-1',
        quantity: 40,
      });
    const transferId = createRes.body.transfer._id;

    const dispatchRes = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.transfer.status).toBe('DISPATCHED');

    // Destination inventory should not exist / not have increased yet
    const destInv = await Inventory.findOne({ location: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1' });
    expect(destInv).toBeNull();

    const receiveRes = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.transfer.status).toBe('RECEIVED');

    const destInvAfter = await Inventory.findOne({ location: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1' });
    expect(destInvAfter.physicalQty).toBe(40);
  });

  it('supports partial receipt without prematurely marking transfer as fully received', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops4@test.com', role: 'OPERATIONS' });
    await createInventory({ location: 'Warehouse-A', physicalQty: 100, reservedQty: 0 });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceLocation: 'Warehouse-A', destinationLocation: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1', quantity: 40 });
    const transferId = createRes.body.transfer._id;

    await request(app).post(`/api/transfers/${transferId}/dispatch`).set('Authorization', `Bearer ${token}`).send({});

    const partial = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 25 });
    expect(partial.body.transfer.status).toBe('RECEIVED_PARTIAL');

    const destInv = await Inventory.findOne({ location: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1' });
    expect(destInv.physicalQty).toBe(25);

    const final = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 15 });
    expect(final.body.transfer.status).toBe('RECEIVED');

    const destInvFinal = await Inventory.findOne({ location: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1' });
    expect(destInvFinal.physicalQty).toBe(40);
  });
});

describe('Test 4: Same transfer cannot be received twice', () => {
  it('rejects a second full receipt attempt after the transfer is already received', async () => {
    const { token } = await createUser({ name: 'Ops', email: 'ops5@test.com', role: 'OPERATIONS' });
    await createInventory({ location: 'Warehouse-A', physicalQty: 100, reservedQty: 0 });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceLocation: 'Warehouse-A', destinationLocation: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1', quantity: 30 });
    const transferId = createRes.body.transfer._id;

    await request(app).post(`/api/transfers/${transferId}/dispatch`).set('Authorization', `Bearer ${token}`).send({});
    const firstReceive = await request(app).post(`/api/transfers/${transferId}/receive`).set('Authorization', `Bearer ${token}`).send({});
    expect(firstReceive.status).toBe(200);

    const secondReceive = await request(app).post(`/api/transfers/${transferId}/receive`).set('Authorization', `Bearer ${token}`).send({});
    expect(secondReceive.status).toBe(400);
    expect(secondReceive.body.message).toMatch(/cannot be received/i);

    const destInv = await Inventory.findOne({ location: 'Warehouse-B', item: 'Test Item', batch: 'BATCH-1' });
    expect(destInv.physicalQty).toBe(30); // did not double-apply
  });
});
