"use strict";

/**
 * Migration 008 — Epoxy & Floor Contractor Database
 *
 * Dedicated tables for the flooring and epoxy contractor vertical:
 *   - epoxy_floor_contractors  — enriched business profiles
 *   - contractor_services      — service tags per contractor (M2M)
 *   - contractor_reviews       — scraped review records
 *   - outreach_campaigns       — campaign-level outreach tracking
 */

exports.up = async function (knex) {
  // ── epoxy_floor_contractors ────────────────────────────────────────────────
  const hasTable = await knex.schema.hasTable("epoxy_floor_contractors");
  if (!hasTable) {
    await knex.schema.createTable("epoxy_floor_contractors", (t) => {
      t.increments("id").primary();

      // Identity
      t.text("company_name").notNullable();
      t.text("owner_name");
      t.text("dba_name"); // "Doing Business As" alias

      // Contact
      t.text("phone");
      t.text("phone_2");
      t.text("email");
      t.text("email_2");
      t.text("website");
      t.text("linkedin_url");
      t.text("facebook_url");
      t.text("instagram_url");

      // Location
      t.text("address");
      t.text("city").notNullable().defaultTo("");
      t.text("state").notNullable().defaultTo("");
      t.text("zip");
      t.text("county");
      t.text("country").defaultTo("US");
      t.decimal("lat", 10, 7);
      t.decimal("lng", 10, 7);

      // Business intelligence
      t.text("industry").defaultTo("flooring");
      t.text("sub_industry"); // epoxy | hardwood | tile | carpet | concrete | laminate
      t.specificType("keywords", "text[]");
      t.specificType("services", "text[]");
      t.decimal("rating", 3, 1);
      t.integer("review_count").defaultTo(0);
      t.text("years_in_business");
      t.text("license_number");
      t.boolean("insured").defaultTo(false);
      t.boolean("bonded").defaultTo(false);

      // Lead management
      t.integer("lead_score").defaultTo(0);
      t.text("tier"); // HOT | WARM | COLD
      t.text("status").defaultTo("new"); // new | contacted | qualified | closed | unqualified
      t.text("source"); // google_maps | yelp | bing | directory | manual
      t.text("source_url");
      t.jsonb("metadata");

      // Timestamps
      t.timestamp("date_scraped", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("last_contacted", { useTz: true });
      t.timestamp("last_enriched", { useTz: true });
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      t.unique(["company_name", "city", "state"]);
    });

    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_efc_lead_score ON epoxy_floor_contractors (lead_score DESC)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_efc_state ON epoxy_floor_contractors (state)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_efc_city ON epoxy_floor_contractors (city)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_efc_tier ON epoxy_floor_contractors (tier)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_efc_status ON epoxy_floor_contractors (status)",
    );
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_efc_date_scraped ON epoxy_floor_contractors (date_scraped DESC)",
    );
  }

  // ── contractor_services ────────────────────────────────────────────────────
  const hasServices = await knex.schema.hasTable("contractor_services");
  if (!hasServices) {
    await knex.schema.createTable("contractor_services", (t) => {
      t.increments("id").primary();
      t.integer("contractor_id")
        .notNullable()
        .references("id")
        .inTable("epoxy_floor_contractors")
        .onDelete("CASCADE");
      t.text("service_name").notNullable(); // epoxy coating | metallic epoxy | flake flooring | etc.
      t.text("service_slug");
      t.text("notes");
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      t.unique(["contractor_id", "service_name"]);
    });
  }

  // ── contractor_reviews ─────────────────────────────────────────────────────
  const hasReviews = await knex.schema.hasTable("contractor_reviews");
  if (!hasReviews) {
    await knex.schema.createTable("contractor_reviews", (t) => {
      t.increments("id").primary();
      t.integer("contractor_id")
        .notNullable()
        .references("id")
        .inTable("epoxy_floor_contractors")
        .onDelete("CASCADE");
      t.text("platform"); // google | yelp | bbb | angi
      t.decimal("rating", 2, 1);
      t.text("reviewer_name");
      t.text("review_text");
      t.text("review_url");
      t.timestamp("reviewed_at", { useTz: true });
      t.timestamp("scraped_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.schema.raw(
      "CREATE INDEX IF NOT EXISTS idx_cr_contractor ON contractor_reviews (contractor_id)",
    );
  }

  // ── outreach_campaigns ─────────────────────────────────────────────────────
  const hasCampaigns = await knex.schema.hasTable("outreach_campaigns");
  if (!hasCampaigns) {
    await knex.schema.createTable("outreach_campaigns", (t) => {
      t.increments("id").primary();
      t.text("campaign_name").notNullable();
      t.text("campaign_type").defaultTo("email"); // email | sms | linkedin | cold_call
      t.text("target_industry").defaultTo("flooring");
      t.text("target_region");
      t.text("target_tier"); // HOT | WARM | COLD | null = all
      t.text("subject");
      t.text("body_template");
      t.text("status").defaultTo("draft"); // draft | active | paused | completed
      t.integer("sent_count").defaultTo(0);
      t.integer("open_count").defaultTo(0);
      t.integer("reply_count").defaultTo(0);
      t.integer("conversion_count").defaultTo(0);
      t.timestamp("scheduled_at", { useTz: true });
      t.timestamp("started_at", { useTz: true });
      t.timestamp("completed_at", { useTz: true });
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("outreach_campaigns");
  await knex.schema.dropTableIfExists("contractor_reviews");
  await knex.schema.dropTableIfExists("contractor_services");
  await knex.schema.dropTableIfExists("epoxy_floor_contractors");
};
