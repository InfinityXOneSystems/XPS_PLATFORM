"use strict";

/**
 * Migration 009 — Vision Cortex Intelligence Database
 *
 * Tables for the Vision Cortex autonomous intelligence system:
 *   - vision_cortex_sources      — seed source registry
 *   - vision_cortex_items        — processed intelligence items
 *   - vision_cortex_briefings    — daily briefing snapshots
 *   - vision_cortex_trends       — aggregated trend tracking
 *   - invention_proposals        — AI-generated invention / opportunity proposals
 */

exports.up = async function (knex) {
  // ── vision_cortex_sources ──────────────────────────────────────────────────
  const hasSources = await knex.schema.hasTable("vision_cortex_sources");
  if (!hasSources) {
    await knex.schema.createTable("vision_cortex_sources", (t) => {
      t.increments("id").primary();
      t.text("source_id").notNullable().unique(); // slug identifier
      t.text("name").notNullable();
      t.text("url").notNullable();
      t.text("category").notNullable(); // ai_research | vc | startup | tech | financial
      t.text("feed_type").defaultTo("rss"); // rss | atom | html | json_api
      t.boolean("active").defaultTo(true);
      t.integer("scrape_interval_minutes").defaultTo(60);
      t.timestamp("last_scraped_at", { useTz: true });
      t.integer("items_scraped").defaultTo(0);
      t.integer("errors_consecutive").defaultTo(0);
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
  }

  // ── vision_cortex_items ────────────────────────────────────────────────────
  const hasItems = await knex.schema.hasTable("vision_cortex_items");
  if (!hasItems) {
    await knex.schema.createTable("vision_cortex_items", (t) => {
      t.increments("id").primary();
      t.integer("source_id")
        .references("id")
        .inTable("vision_cortex_sources")
        .onDelete("SET NULL");
      t.text("source_slug");
      t.text("source_name");
      t.text("category");

      // Content
      t.text("title").notNullable();
      t.text("url");
      t.text("summary");
      t.text("full_text");
      t.text("author");
      t.specificType("tags", "text[]");

      // Intelligence scoring
      t.integer("relevance_score").defaultTo(0);
      t.integer("sentiment_score").defaultTo(0); // -10 to +10
      t.specificType("keywords_extracted", "text[]");
      t.text("primary_category");
      t.specificType("secondary_categories", "text[]");
      t.boolean("is_opportunity").defaultTo(false);
      t.boolean("is_risk").defaultTo(false);
      t.boolean("is_trending").defaultTo(false);

      // Dedup
      t.text("content_hash"); // SHA-256 of title+url for dedup
      t.boolean("is_duplicate").defaultTo(false);

      // Timestamps
      t.timestamp("published_at", { useTz: true });
      t.timestamp("scraped_at", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("processed_at", { useTz: true });
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());

      t.unique(["content_hash"]);
    });

    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vci_relevance ON vision_cortex_items (relevance_score DESC)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vci_category ON vision_cortex_items (category)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vci_scraped ON vision_cortex_items (scraped_at DESC)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vci_opportunity ON vision_cortex_items (is_opportunity) WHERE is_opportunity = true",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vci_trending ON vision_cortex_items (is_trending) WHERE is_trending = true",
    );
  }

  // ── vision_cortex_briefings ────────────────────────────────────────────────
  const hasBriefings = await knex.schema.hasTable("vision_cortex_briefings");
  if (!hasBriefings) {
    await knex.schema.createTable("vision_cortex_briefings", (t) => {
      t.increments("id").primary();
      t.date("briefing_date").notNullable().unique();
      t.text("title");
      t.text("summary");
      t.text("markdown_content");
      t.jsonb("stats"); // { total_items, hot_count, opportunity_count, ... }
      t.specificType("top_keywords", "text[]");
      t.specificType("top_opportunities", "integer[]"); // FK refs to vision_cortex_items
      t.timestamp("generated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
  }

  // ── vision_cortex_trends ───────────────────────────────────────────────────
  const hasTrends = await knex.schema.hasTable("vision_cortex_trends");
  if (!hasTrends) {
    await knex.schema.createTable("vision_cortex_trends", (t) => {
      t.increments("id").primary();
      t.date("trend_date").notNullable();
      t.text("keyword").notNullable();
      t.text("category");
      t.integer("mention_count").defaultTo(1);
      t.decimal("avg_relevance", 5, 2).defaultTo(0);
      t.integer("velocity").defaultTo(0); // change vs prior period
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      t.unique(["trend_date", "keyword"]);
    });
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vct_date ON vision_cortex_trends (trend_date DESC)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vct_keyword ON vision_cortex_trends (keyword)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_vct_mentions ON vision_cortex_trends (mention_count DESC)",
    );
  }

  // ── invention_proposals ────────────────────────────────────────────────────
  const hasInventions = await knex.schema.hasTable("invention_proposals");
  if (!hasInventions) {
    await knex.schema.createTable("invention_proposals", (t) => {
      t.increments("id").primary();
      t.text("title").notNullable();
      t.text("description");
      t.text("problem_statement");
      t.text("proposed_solution");
      t.text("target_market");
      t.text("industry");
      t.specificType("tags", "text[]");
      t.specificType("source_item_ids", "integer[]"); // vision_cortex_items that inspired this
      t.text("status").defaultTo("proposed"); // proposed | evaluated | approved | archived
      t.decimal("opportunity_score", 5, 2).defaultTo(0);
      t.text("ai_analysis"); // LLM-generated analysis
      t.jsonb("metadata");
      t.timestamp("generated_at", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("evaluated_at", { useTz: true });
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_ip_score ON invention_proposals (opportunity_score DESC)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_ip_status ON invention_proposals (status)",
    );
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("invention_proposals");
  await knex.schema.dropTableIfExists("vision_cortex_trends");
  await knex.schema.dropTableIfExists("vision_cortex_briefings");
  await knex.schema.dropTableIfExists("vision_cortex_items");
  await knex.schema.dropTableIfExists("vision_cortex_sources");
};
