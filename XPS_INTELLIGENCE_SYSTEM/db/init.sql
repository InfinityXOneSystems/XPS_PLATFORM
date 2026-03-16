-- Create leads table if it doesn't exist
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(2),
    lead_score INTEGER DEFAULT 0,
    tier VARCHAR(50),
    company VARCHAR(255),
    score INTEGER DEFAULT 0,
    location VARCHAR(255),
    status VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(20),
    website VARCHAR(255),
    address TEXT,
    industry VARCHAR(100),
    rating DECIMAL(3,1),
    reviews INTEGER,
    source VARCHAR(100),
    "scrapedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on company_name for faster searches
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score DESC);
