class LeadScorer:
    """
    Scores leads 0-100 based on data completeness and quality signals.

    Scoring breakdown:
      +20  Has email
      +20  Has phone
      +20  Has website
      +20  Reviews > 10
      +20  Rating > 4.0
    """

    def score(self, contractor) -> float:
        score = 0.0
        factors = {}

        if contractor.email:
            score += 20
            factors["has_email"] = 20

        if contractor.phone:
            score += 20
            factors["has_phone"] = 20

        if contractor.website:
            score += 20
            factors["has_website"] = 20

        reviews = contractor.reviews or 0
        if reviews > 10:
            score += 20
            factors["reviews_gt_10"] = 20
        elif reviews > 5:
            score += 10
            factors["reviews_gt_5"] = 10

        rating = contractor.rating or 0.0
        if rating > 4.0:
            score += 20
            factors["rating_gt_4"] = 20
        elif rating > 3.5:
            score += 10
            factors["rating_gt_3_5"] = 10

        return min(round(score, 2), 100.0)

    def score_dict(self, data: dict) -> float:
        class _Obj:
            pass

        obj = _Obj()
        for k, v in data.items():
            setattr(obj, k, v)
        return self.score(obj)
