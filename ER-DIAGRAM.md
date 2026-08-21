# Database Schema / ER Diagram

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string name
        string email UK
        string passwordHash
        string role "ADMIN | OPERATIONS | SALES"
        string assignedLocation "nullable"
        boolean isActive
        number refreshTokenVersion
    }

    INVENTORY {
        ObjectId _id PK
        string item
        string category
        string location
        string batch
        number physicalQty
        number reservedQty
        number availableQty "virtual = physicalQty - reservedQty"
    }

    INVENTORY_TRANSACTION {
        ObjectId _id PK
        string idempotencyKey UK
        string type "STOCK_IN | DAMAGE | TRANSFER_DISPATCH | TRANSFER_RECEIPT | RESERVATION | RESERVATION_RELEASE"
        ObjectId inventory FK
        number quantity "signed: +in / -out"
        ObjectId performedBy FK
        mixed reference "e.g. { transferId, orderId }"
    }

    WORK_ORDER {
        ObjectId _id PK
        string workOrderCode UK
        string location
        string item
        number requiredQty
        ObjectId assignedUser FK
        ObjectId createdBy FK
        string status "ASSIGNED | IN_PROGRESS | COMPLETED"
        number stockCheck_availableAtLocation
        number stockCheck_shortage
    }

    TRANSFER {
        ObjectId _id PK
        string transferCode UK
        string sourceLocation
        string destinationLocation
        string item
        string batch
        number quantity
        number quantityReceived
        string status "REQUESTED | DISPATCHED | RECEIVED_PARTIAL | RECEIVED"
        ObjectId requestedBy FK
        ObjectId dispatchedBy FK
        ObjectId receivedBy FK
        ObjectId workOrder FK "nullable"
    }

    ORDER {
        ObjectId _id PK
        string orderCode UK
        string customerName
        string item
        string location
        string batch
        number quantity
        string status "RESERVED | FULFILLED | CANCELLED"
        ObjectId createdBy FK
        ObjectId cancelledBy FK
    }

    USER ||--o{ WORK_ORDER : "assignedUser"
    USER ||--o{ WORK_ORDER : "createdBy"
    USER ||--o{ TRANSFER : "requestedBy / dispatchedBy / receivedBy"
    USER ||--o{ ORDER : "createdBy / cancelledBy"
    USER ||--o{ INVENTORY_TRANSACTION : "performedBy"
    INVENTORY ||--o{ INVENTORY_TRANSACTION : "logs changes to"
    WORK_ORDER ||--o{ TRANSFER : "may trigger"
```

## Key design decisions

**`availableQty` is never stored.** It's a derived virtual (`physicalQty - reservedQty`)
computed at read time, so it can never drift out of sync with its inputs — there is no way
for a bug to update one but not the other.

**Every stock-changing operation is an atomic, guarded MongoDB update**, not a
read-check-then-write. For example, reserving stock for a customer order runs:

```js
Inventory.findOneAndUpdate(
  { item, location, batch, $expr: { $gte: [{ $subtract: ['$physicalQty', '$reservedQty'] }, qty] } },
  { $inc: { reservedQty: qty } }
)
```

The availability check and the increment happen as a single atomic document operation on
the MongoDB server. Two concurrent requests hitting the same document cannot both pass the
check — the second one always re-evaluates the *current* document state, so it's impossible
for both to succeed even without an application-level lock. This is what makes the
"two users reserve 80 + 50 against 100 available" scenario safe.

**Multi-document writes (reservation + order row, dispatch + ledger + transfer status,
etc.) are wrapped in Mongo replica-set transactions** (`session.withTransaction`) so that
either the whole operation lands or none of it does — no half-applied transfers or
orders with no matching inventory transaction.

**Every state-changing endpoint accepts an `idempotencyKey`.** If a request is retried
(double-click, network retry, etc.) with the same key, the operation returns the
already-applied result instead of double-applying the change. This is the mechanism that
also prevents a transfer from being received twice.
