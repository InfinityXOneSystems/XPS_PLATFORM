import json
import csv
import requests
from datetime import datetime
from urllib.parse import urlparse

INPUT_FILE = "data/raw/raw_leads.json"
OUTPUT_FILE = "data/exports/sales_ready_leads.csv"

def schema():

    return {
        "company_name":"",
        "industry":"",
        "address":"",
        "city":"",
        "state":"",
        "postal_code":"",
        "phone":"",
        "website":"",
        "email_domain":"",
        "google_rating":"",
        "review_count":"",
        "linkedin_company":"",
        "primary_decision_role":"",
        "employee_estimate":"",
        "business_type":"",
        "year_established":"",
        "government_registration":"",
        "bbb_rating":"",
        "recent_reviews":"",
        "hiring_activity":"",
        "marketing_activity":"",
        "validation_status":"unknown",
        "lead_score":0,
        "last_verified":""
    }

def normalize(raw):

    lead = schema()

    lead["company_name"] = raw.get("company") or raw.get("name")
    lead["industry"] = raw.get("industry")
    lead["phone"] = raw.get("phone")
    lead["website"] = raw.get("website")
    lead["city"] = raw.get("city")
    lead["state"] = raw.get("state")

    if lead["website"]:
        lead["email_domain"] = urlparse(lead["website"]).netloc

    return lead

def validate_website(url):

    if not url:
        return False

    try:

        r = requests.get(url,timeout=5)

        if r.status_code < 400:
            return True

    except:
        pass

    return False

def score(lead):

    score = 0

    if lead["website"]:
        score += 20

    if lead["google_rating"]:
        try:
            if float(lead["google_rating"]) > 4:
                score += 15
        except:
            pass

    if lead["review_count"]:
        try:
            if int(lead["review_count"]) > 20:
                score += 15
        except:
            pass

    if lead["employee_estimate"]:
        score += 15

    if lead["marketing_activity"]:
        score += 20

    lead["lead_score"] = score

    if score > 70:
        lead["validation_status"] = "active"
    elif score > 40:
        lead["validation_status"] = "warm"
    else:
        lead["validation_status"] = "cold"

    return lead

def validate(lead):

    if validate_website(lead["website"]):
        lead["validation_status"] = "active"

    lead["last_verified"] = datetime.utcnow().isoformat()

    return lead

def run():

    print("Loading leads")

    with open(INPUT_FILE) as f:
        raw = json.load(f)

    results = []

    for r in raw:

        lead = normalize(r)

        lead = validate(lead)

        lead = score(lead)

        results.append(lead)

    print("Exporting")

    with open(OUTPUT_FILE,"w",newline="",encoding="utf8") as f:

        writer = csv.DictWriter(f,fieldnames=schema().keys())

        writer.writeheader()

        for r in results:
            writer.writerow(r)

    print("Pipeline complete")

if __name__ == "__main__":
    run()
