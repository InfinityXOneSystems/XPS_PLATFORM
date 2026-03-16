"use strict";

/**
 * Migration 007 — Vector embeddings (Qdrant integration)
 *
 * Stores the mapping between PostgreSQL entities and their corresponding
 * vector representations in Qdrant collections.
 *
 * The actual vectors live in Qdrant; this table is the source-of-truth
 * for which entities have been embedded and when.
 */

exports.up = async function (knex) {
  await knex.schema.createTable("vector_embeddings", (t) => {
    t.increments("id").primary();
    t.text("entity_type").notNullable(); // lead|agent_task|scrape_task
    t.integer("entity_id").notNullable();
    t.text("collection_name").notNullable(); // Qdrant collection
    // qdrant_id is the UUID used as the point ID in Qdrant
    t.uuid("qdrant_id").notNullable();
    t.integer("embedding_dim"); // vector dimension (e.g. 1536 for ada-002)
    t.text("model_name"); // embedding model used
    t.jsonb("metadata"); // payload stored alongside the vector
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    t.unique(["entity_type", "entity_id", "collection_name"]);
  });

  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_vector_embeddings_entity    ON vector_embeddings (entity_type, entity_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_vector_embeddings_qdrant_id ON vector_embeddings (qdrant_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX IF NOT EXISTS idx_vector_embeddings_collection ON vector_embeddings (collection_name)",
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("vector_embeddings");
};
