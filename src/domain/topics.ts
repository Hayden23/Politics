export const TOPICS = [
  { slug: "economy", name: "Economy" },
  { slug: "healthcare", name: "Healthcare" },
  { slug: "immigration", name: "Immigration" },
  { slug: "education", name: "Education" },
  { slug: "civil-liberties", name: "Civil liberties" },
  { slug: "foreign-policy", name: "Foreign policy" },
  { slug: "climate-energy", name: "Climate and energy" },
  { slug: "technology-privacy", name: "Technology and privacy" },
  { slug: "crime-public-safety", name: "Crime and public safety" },
  { slug: "housing-cost-of-living", name: "Housing and cost of living" },
] as const;

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const GEOGRAPHIC_TYPES = ["urban", "suburban", "rural"] as const;
export const POLITICAL_IDS = ["very liberal", "liberal", "moderate", "conservative", "very conservative", "other", "prefer not to say"] as const;
