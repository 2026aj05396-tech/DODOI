import { LDNOOBW_ENGLISH, LDNOOBW_HINDI } from "./blocklist-data/ldnoobw";

// Offensive words and phrases rejected in custom interests (OD-13, OD-36): LDNOOBW English and
// romanised Hindi lists, minus terms that are ordinary craft vocabulary. Each exception was
// reviewed by hand; abuse that slips through is handled by admin hiding and user reports.
const CRAFT_SAFE_EXCEPTIONS: Readonly<Record<string, string>> = {
  fingering: "knitting yarn weight ('fingering yarn')",
  swastika: "auspicious symbol in Indian rangoli, mandala and Jain/Hindu crafts",
  butt: "woodworking ('butt joint', 'butt hinge')",
  panty: "lingerie sewing",
  panties: "lingerie sewing",
  nude: "paint colour; life/figure drawing",
  tit: "bird ('blue tit embroidery')",
  "jelly donut": "cake decorating",
  "chocolate rosebuds": "cake decorating",
  "violet wand": "fairy-wand crafts",
  "big black": "ordinary word pair",
  "tight white": "ordinary word pair",
  "tied up": "ordinary word pair",
  "girl on": "ordinary word pair",
  "hot chick": "ordinary word pair (chick crafts)",
  "tongue in a": "ordinary word sequence",
  "taste my": "ordinary word sequence",
  pataka: "Hindi 'firecracker' (Diwali crafts)",
  patakha: "Hindi 'firecracker' (Diwali crafts)",
  maal: "Hindi 'goods, stuff'",
  kutta: "Hindi 'dog' (animal crafts)",
  suar: "Hindi 'pig' (animal crafts)",
  gucchi: "Hindi 'morel mushroom'",
};

export const BLOCKED_SKILL_TERMS: readonly string[] = [...LDNOOBW_ENGLISH, ...LDNOOBW_HINDI].filter(
  (term) => !(term in CRAFT_SAFE_EXCEPTIONS),
);

export const CRAFT_SAFE_EXCEPTION_TERMS: readonly string[] = Object.keys(CRAFT_SAFE_EXCEPTIONS);
