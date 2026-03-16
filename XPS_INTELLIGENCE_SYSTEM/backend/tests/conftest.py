import json
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import String, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import Text, TypeDecorator

# Set test DATABASE_URL BEFORE any app modules are imported so that
# `settings` picks it up and database.py creates a SQLite engine.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

# ---------------------------------------------------------------------------
# Monkeypatch PostgreSQL-specific types so the SQLite test DB works.
# These patches MUST happen before any app model module is imported.
# ---------------------------------------------------------------------------
import sqlalchemy  # noqa: E402
from sqlalchemy.dialects import postgresql as _pg  # noqa: E402


class _JSONArray(TypeDecorator):
    """Stores Python lists as JSON text in SQLite."""

    impl = Text
    cache_ok = True

    def __init__(self, *args, **kwargs):
        # Discard ARRAY's item_type argument; Text needs no args
        TypeDecorator.__init__(self)

    def process_bind_param(self, value, dialect):
        return json.dumps(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return json.loads(value) if value is not None else []


class _StringUUID(TypeDecorator):
    """Stores UUIDs as plain strings in SQLite."""

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return value


# Patch sqlalchemy.ARRAY (used via `from sqlalchemy import ARRAY` in models)
sqlalchemy.ARRAY = _JSONArray
# Patch postgresql-dialect types (used via `from sqlalchemy.dialects.postgresql import ...`)
_pg.ARRAY = lambda *a, **kw: _JSONArray()
_pg.UUID = lambda *a, **kw: _StringUUID()
_pg.JSONB = lambda *a, **kw: Text()

# ---------------------------------------------------------------------------

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
