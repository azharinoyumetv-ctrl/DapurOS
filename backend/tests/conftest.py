"""The older isolated contract suites use MongoMock, which has no sessions.

Emulate rollback only in those test doubles. Production code always requires a
real MongoDB transaction; concurrency/rollback tests use a real replica set.
"""
import copy
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import transactions


@pytest.fixture(autouse=True)
def mock_transaction_adapter(monkeypatch):
    original = transactions.run_transaction
    async def execute(db, operation):
        snapshot_db=vars(db).get('_transaction_test_db',vars(type(db)).get('_transaction_test_db',db))
        if '_AsyncMongoMockDatabase__database' not in vars(snapshot_db):
            return await original(db, operation)
        names = await snapshot_db.list_collection_names()
        snapshots = {name: copy.deepcopy(await snapshot_db[name].find({}).to_list(None)) for name in names}
        try:
            return await operation(None)
        except Exception:
            for name in await snapshot_db.list_collection_names():
                await snapshot_db[name].delete_many({})
            for name, documents in snapshots.items():
                if documents:
                    await snapshot_db[name].insert_many(documents)
            raise
    monkeypatch.setattr(transactions, 'run_transaction', execute)
