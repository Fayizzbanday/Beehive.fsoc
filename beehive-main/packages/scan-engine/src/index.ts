import type {
  DigitalTwin,
  PlacementReport,
  ScanFinding,
  ScanMetric,
  ScanMode,
  ScanReport,
  TwinFrame,
} from "../../shared/src/index";
import { classification } from "../../risk-engine/src/index";
export const SCAN_ENGINE_VERSION = "beehive.vision-sim.v1";
export const SCAN_SCOPE =
  "Simulated computer-vision output for prototype demonstration. Frames are captured on device and summarised by a deterministic model; this is not a diagnostic instrument, a laboratory test, or part of the certified on-chain record.";
interface ModeResult {
  score: number;
  headline: ScanReport["headline"];
  title: string;
  summary: string;
  metrics: ScanMetric[];
  findings: ScanFinding[];
  recommendations: string[];
  frames: ScanReport["frames"];
  twin?: DigitalTwin;
  placement?: PlacementReport;
}
interface DiseaseDetection {
  name: string;
  probability: number;
  window: string;
  trigger: string;
  action: string;
  severity: ScanFinding["severity"];
  affectedFrames: number;
}
export interface ScanContext {
  hive?: {
    publicId: string;
    name: string;
    status: string;
    healthScore: number;
    temperature: number | null;
    humidity: number | null;
    weight: number | null;
    activity: number | null;
    species: string;
    queenAge: number;
  } | null;
  apiary?: {
    name: string;
    location: string;
    latitude: number;
    longitude: number;
  } | null;
  weightTrend?: number;
  durationSeconds: number;
  frameCount: number;
  now?: string;
}
/** FNV-1a over the capture digest, expanded by mulberry32: the same video always yields the same report. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (value: number, places = 1) =>
  Number(value.toFixed(places)) + 0; /* normalises -0 */
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
function band(
  value: number,
  good: number,
  watch: number,
  higherIsBetter = true,
): ScanMetric["band"] {
  const ok = higherIsBetter ? value >= good : value <= good;
  const middling = higherIsBetter ? value >= watch : value <= watch;
  return ok ? "good" : middling ? "watch" : "poor";
}
function confidenceFor(context: ScanContext, base: number) {
  return round(
    clamp(
      base +
        Math.min(0.08, context.frameCount * 0.012) +
        Math.min(0.05, context.durationSeconds * 0.004) +
        (context.hive?.temperature != null ? 0.04 : 0),
      0.4,
      0.95,
    ),
    2,
  );
}
function frameNotes(
  random: () => number,
  context: ScanContext,
  labels: string[],
) {
  return Array.from({ length: context.frameCount }, (_, index) => ({
    index,
    timeOffset: round(
      (context.durationSeconds / Math.max(1, context.frameCount)) * index,
      1,
    ),
    label: labels[index % labels.length],
    focus: Math.round(74 + random() * 24),
  }));
}
function region(random: () => number) {
  const width = round(0.17 + random() * 0.2, 3);
  const height = round(0.16 + random() * 0.2, 3);
  return {
    x: round(0.06 + random() * (0.86 - width), 3),
    y: round(0.08 + random() * (0.8 - height), 3),
    width,
    height,
  };
}
function honeyQuality(random: () => number, context: ScanContext): ModeResult {
  const hiveHumidity = context.hive?.humidity ?? 55;
  const capped = Math.round(clamp(72 + random() * 26, 58, 99));
  const moisture = round(
    clamp(16.4 + (hiveHumidity - 55) * 0.07 + (88 - capped) * 0.05, 14, 24.5),
    1,
  );
  const crystallisation = Math.round(6 + random() * 26);
  const pfund = Math.round(18 + random() * 62);
  const debris = round(random() * 1.4, 2);
  const ripeness = Math.round(
    clamp(capped * 0.62 + (23 - moisture) * 5.5 - debris * 6, 20, 99),
  );
  const metrics: ScanMetric[] = [
    {
      key: "capped_cells",
      label: "Capped cells",
      value: capped,
      unit: "%",
      band: band(capped, 85, 75),
      detail: "Share of visible cells sealed with wax across sampled frames.",
      benchmark: "Ready to extract above 85%",
    },
    {
      key: "moisture_estimate",
      label: "Estimated moisture",
      value: moisture,
      unit: "%",
      band: band(moisture, 18.5, 20, false),
      detail:
        "Inferred from cell sheen, capping ratio and in-hive humidity telemetry.",
      benchmark: "Screening range 16–20%",
    },
    {
      key: "crystallisation",
      label: "Crystallisation",
      value: crystallisation,
      unit: "index",
      band: band(crystallisation, 15, 28, false),
      detail: "Granulation visible in the comb face and drawn honey.",
      benchmark: "Low below 15",
    },
    {
      key: "colour_grade",
      label: "Colour grade",
      value: pfund,
      unit: "mm Pfund",
      band: "good",
      detail: "Optical colour estimate against the Pfund reference ramp.",
      benchmark: "Acacia 10–34 · Multiflora 35–85",
    },
    {
      key: "foreign_particles",
      label: "Foreign particles",
      value: debris,
      unit: "per frame",
      band: band(debris, 0.5, 1, false),
      detail: "Wax flakes, propolis fragments and debris detected in frame.",
      benchmark: "Clean below 0.5",
    },
    {
      key: "ripeness",
      label: "Harvest readiness",
      value: ripeness,
      unit: "/ 100",
      band: band(ripeness, 80, 62),
      detail: "Composite of capping, moisture and comb condition.",
      benchmark: "Extract above 80",
    },
  ];
  const findings: ScanFinding[] = [];
  if (capped < 85)
    findings.push({
      id: "uncapped_cells",
      title: `${100 - capped}% of cells still uncapped`,
      severity: capped < 75 ? "ACTION" : "WATCH",
      confidence: round(0.72 + random() * 0.2, 2),
      detail:
        "Open cells cluster along the lower third of the sampled frames, where nectar is still being ripened.",
      action:
        "Leave the super in place for 3–5 days and re-scan before extraction.",
      frame: Math.floor(random() * context.frameCount),
      region: region(random),
    });
  if (moisture > 20)
    findings.push({
      id: "moisture_high",
      title: `Estimated moisture ${moisture}% exceeds the screening range`,
      severity: "ACTION",
      confidence: round(0.68 + random() * 0.2, 2),
      detail:
        "High moisture raises fermentation risk and would be flagged by the batch risk engine at certification.",
      action:
        "Confirm with a calibrated refractometer before creating the batch.",
      frame: Math.floor(random() * context.frameCount),
      region: region(random),
    });
  if (debris > 0.5)
    findings.push({
      id: "debris",
      title: "Wax and propolis debris on the comb face",
      severity: "WATCH",
      confidence: round(0.6 + random() * 0.24, 2),
      detail:
        "Loose fragments were detected on the comb surface during the sweep.",
      action: "Brush frames and filter after extraction.",
      frame: Math.floor(random() * context.frameCount),
      region: region(random),
    });
  findings.push({
    id: "comb_structure",
    title: "Comb drawn evenly across the sampled frames",
    severity: "INFO",
    confidence: round(0.8 + random() * 0.14, 2),
    detail: `Colour estimate of ${pfund} mm Pfund is consistent across the sweep, with no bridging or blown comb detected.`,
    action: "No action required.",
    frame: 0,
    region: region(random),
  });
  const score = Math.round(
    clamp(
      (100 - ripeness) * 0.55 +
        Math.max(0, moisture - 19) * 9 +
        Math.max(0, 85 - capped) * 0.5 +
        debris * 8,
      2,
      96,
    ),
  );
  return {
    score,
    headline: { label: "Harvest readiness", value: ripeness, unit: "/ 100" },
    title:
      ripeness >= 80
        ? "This comb is ready to extract."
        : ripeness >= 62
          ? "Nearly ready — give the colony a few more days."
          : "Hold the harvest. The comb is not ripe.",
    summary: `${capped}% of cells are capped with an estimated ${moisture}% moisture. Colour reads ${pfund} mm Pfund with a readiness score of ${ripeness} / 100.`,
    metrics,
    findings,
    recommendations: [
      ripeness >= 80
        ? "Extract within the next week while capping holds."
        : "Re-scan after 4 days and compare the readiness trend.",
      "Record the measured moisture on the batch so the risk engine screens the real value.",
      "Attach a laboratory certificate to raise the certified record's evidence score.",
    ],
    frames: frameNotes(random, context, [
      "Outer honey frame",
      "Capped comb face",
      "Brood-super boundary",
      "Frame lifted to light",
    ]),
  };
}
function environment(random: () => number, context: ScanContext): ModeResult {
  const latitude = context.apiary?.latitude ?? 30;
  const sunlight = round(clamp(5.4 + random() * 3.4, 4, 9.2), 1);
  const forage = Math.round(clamp(46 + random() * 48, 30, 97));
  const water = Math.round(40 + random() * 420);
  const wind = Math.round(clamp(14 + random() * 60, 8, 82));
  const slope = round(1 + random() * 11, 1);
  const traffic = Math.round(random() * 68);
  const drift = Math.round(280 + random() * 1600);
  const suitability = Math.round(
    clamp(
      forage * 0.34 +
        Math.min(100, sunlight * 11) * 0.22 +
        (100 - wind) * 0.16 +
        clamp(100 - water / 6, 0, 100) * 0.12 +
        (100 - traffic) * 0.09 +
        clamp(drift / 20, 0, 100) * 0.07,
      24,
      96,
    ),
  );
  const orientation =
    latitude > 28 ? "South-east facing entrance" : "East facing entrance";
  const metrics: ScanMetric[] = [
    {
      key: "forage_density",
      label: "Forage density",
      value: forage,
      unit: "/ 100",
      band: band(forage, 70, 50),
      detail: "Flowering cover estimated from the vegetation sweep.",
      benchmark: "Strong above 70",
    },
    {
      key: "sunlight",
      label: "Direct morning sun",
      value: sunlight,
      unit: "hours",
      band: band(sunlight, 6, 4.5),
      detail: "Sun path modelled from the horizon line and canopy shadow.",
      benchmark: "Target 6+ hours",
    },
    {
      key: "wind_exposure",
      label: "Wind exposure",
      value: wind,
      unit: "/ 100",
      band: band(wind, 35, 55, false),
      detail: "Open fetch measured against detected windbreaks.",
      benchmark: "Sheltered below 35",
    },
    {
      key: "water_distance",
      label: "Nearest water",
      value: water,
      unit: "m",
      band: band(water, 250, 400, false),
      detail: "Distance to the closest standing or running water in frame.",
      benchmark: "Within 250 m",
    },
    {
      key: "ground_slope",
      label: "Ground slope",
      value: slope,
      unit: "°",
      band: band(slope, 6, 9, false),
      detail: "Surface gradient and drainage read from the ground plane.",
      benchmark: "Drains well at 2–6°",
    },
    {
      key: "disturbance",
      label: "Human & livestock traffic",
      value: traffic,
      unit: "/ 100",
      band: band(traffic, 30, 55, false),
      detail: "Paths, gates and grazing signs detected along the sweep.",
      benchmark: "Quiet below 30",
    },
  ];
  const spots = [
    {
      id: "spot-a",
      label: "Primary stand",
      suitability,
      orientation,
      distanceMeters: 0,
      rationale:
        "Best balance of morning sun, shelter and forage in the scanned area.",
      x: 26,
      y: 58,
    },
    {
      id: "spot-b",
      label: "Secondary stand",
      suitability: Math.max(30, suitability - 6 - Math.round(random() * 7)),
      orientation,
      distanceMeters: 18 + Math.round(random() * 30),
      rationale:
        "Slightly more exposed to afternoon wind but closer to the tree line.",
      x: 62,
      y: 40,
    },
    {
      id: "spot-c",
      label: "Overflow stand",
      suitability: Math.max(24, suitability - 14 - Math.round(random() * 9)),
      orientation: "East facing entrance",
      distanceMeters: 35 + Math.round(random() * 60),
      rationale:
        "Usable during a strong flow; drainage is weaker after rainfall.",
      x: 78,
      y: 70,
    },
  ];
  const cautions: string[] = [];
  if (wind > 45)
    cautions.push(
      "Open fetch on the exposed edge — plant or build a windbreak before placing hives.",
    );
  if (water > 250)
    cautions.push(
      `Nearest water is ${water} m away — provide a shallow water station with landing stones.`,
    );
  if (drift < 700)
    cautions.push(
      `Cultivated land detected ${drift} m away — confirm the spray calendar with the farmer.`,
    );
  if (traffic > 45)
    cautions.push(
      "Footpath and livestock traffic crosses the site — fence the stand and face entrances away from the path.",
    );
  const findings: ScanFinding[] = [
    {
      id: "placement",
      title: `${orientation} at the primary stand`,
      severity: "INFO",
      confidence: round(0.74 + random() * 0.18, 2),
      detail:
        "Entrance orientation gives the colony early warmth and keeps prevailing wind off the landing board.",
      action: `Set stands 35–45 cm above ground with ${round(0.8 + random() * 0.6, 1)} m spacing.`,
      frame: 0,
      region: region(random),
    },
    {
      id: "forage",
      title: `Forage density reads ${forage} / 100 within the sweep`,
      severity: forage < 50 ? "WATCH" : "INFO",
      confidence: round(0.66 + random() * 0.22, 2),
      detail:
        "Flowering cover, tree line and ground flora were sampled across the captured frames.",
      action:
        forage < 50
          ? "Plan supplementary feeding or move during the dearth period."
          : "Carrying capacity supports the recommended colony count.",
      frame: Math.min(1, context.frameCount - 1),
      region: region(random),
    },
  ];
  if (wind > 45)
    findings.push({
      id: "windbreak",
      title: "No effective windbreak on the exposed edge",
      severity: "ACTION",
      confidence: round(0.63 + random() * 0.24, 2),
      detail:
        "The sweep shows open ground with no hedge or structure to break the prevailing wind.",
      action: "Position stands behind the tree line or install a 1.8 m screen.",
      frame: Math.floor(random() * context.frameCount),
      region: region(random),
    });
  const placement: PlacementReport = {
    suitability,
    orientation,
    sunlightHours: sunlight,
    carryingCapacity: Math.max(2, Math.round(forage / 9)),
    recommendedSpots: spots,
    cautions: cautions.length
      ? cautions
      : ["No blocking site conditions were detected in the scanned area."],
  };
  return {
    score: 100 - suitability,
    headline: { label: "Site suitability", value: suitability, unit: "/ 100" },
    title:
      suitability >= 75
        ? "A strong site for a hive stand."
        : suitability >= 55
          ? "Workable site with conditions to fix first."
          : "Look for a better site nearby.",
    summary: `Site suitability is ${suitability} / 100 with ${forage} / 100 forage density, ${sunlight} hours of direct morning sun and water ${water} m away. The area supports about ${Math.max(2, Math.round(forage / 9))} colonies.`,
    metrics,
    findings,
    recommendations: [
      `Place the first stand at the primary marker with a ${orientation.toLowerCase()}.`,
      ...placement.cautions.slice(0, 2),
      "Re-scan the site after the next flowering change to track carrying capacity.",
    ],
    placement,
    frames: frameNotes(random, context, [
      "Ground plane and drainage",
      "Horizon and sun path",
      "Tree line and windbreak",
      "Forage cover sweep",
    ]),
  };
}
const DISEASES = [
  {
    name: "Varroa destructor",
    base: 0.34,
    window: "7 days",
    trigger: "Mite fall on the sampled brood frames",
    action: "Run a sugar-roll count and treat before the next brood cycle.",
  },
  {
    name: "Chalkbrood",
    base: 0.18,
    window: "14 days",
    trigger: "Mummified larvae at the hive entrance",
    action: "Improve ventilation and replace damp comb.",
  },
  {
    name: "Nosema",
    base: 0.15,
    window: "21 days",
    trigger: "Soiling on the landing board and frame tops",
    action: "Send a sample for microscopy and reduce colony stress.",
  },
  {
    name: "Wax moth",
    base: 0.2,
    window: "10 days",
    trigger: "Silk tunnelling across stored comb",
    action: "Remove unoccupied comb and freeze stored supers.",
  },
  {
    name: "European foulbrood",
    base: 0.09,
    window: "5 days",
    trigger: "Discoloured, twisted larvae in open cells",
    action: "Isolate the colony and notify the apiary inspector.",
  },
  {
    name: "Small hive beetle",
    base: 0.12,
    window: "14 days",
    trigger: "Beetles sheltering along the frame rails",
    action: "Trap adults and keep colonies strong enough to patrol comb.",
  },
];
function disease(
  random: () => number,
  context: ScanContext,
): ModeResult & { expected: DiseaseDetection[] } {
  const health = context.hive?.healthScore ?? 72;
  const stress = clamp((80 - health) / 60, 0, 1);
  const detections: DiseaseDetection[] = DISEASES.map((d) => {
    const probability = round(
      clamp(d.base * (0.45 + random() * 1.1) + stress * 0.3, 0.01, 0.94),
      2,
    );
    return {
      ...d,
      probability,
      severity: (probability >= 0.55
        ? "ACTION"
        : probability >= 0.3
          ? "WATCH"
          : "INFO") as ScanFinding["severity"],
      affectedFrames: Math.round(probability * 100),
    };
  }).sort((a, b) => b.probability - a.probability);
  const miteLoad = round(
    clamp(detections[0].probability * 9 + random() * 1.6, 0.2, 11),
    1,
  );
  const broodPattern = Math.round(
    clamp(94 - stress * 34 - random() * 14, 42, 98),
  );
  const mortality = Math.round(clamp(stress * 60 + random() * 22, 2, 78));
  const wingIndex = round(
    clamp(detections[0].probability * 6 + random() * 2, 0, 9),
    1,
  );
  const metrics: ScanMetric[] = [
    {
      key: "mite_load",
      label: "Estimated mite load",
      value: miteLoad,
      unit: "per 100 bees",
      band: band(miteLoad, 2, 4, false),
      detail: "Phoretic mites counted on bees crossing the sampled frames.",
      benchmark: "Treatment threshold 3 per 100",
    },
    {
      key: "brood_pattern",
      label: "Brood pattern regularity",
      value: broodPattern,
      unit: "%",
      band: band(broodPattern, 85, 70),
      detail: "Continuity of sealed brood across the comb face.",
      benchmark: "Healthy queen above 85%",
    },
    {
      key: "entrance_mortality",
      label: "Entrance mortality",
      value: mortality,
      unit: "/ 100",
      band: band(mortality, 20, 45, false),
      detail: "Dead and crawling bees observed at the landing board.",
      benchmark: "Normal below 20",
    },
    {
      key: "deformed_wing",
      label: "Deformed wing indicator",
      value: wingIndex,
      unit: "/ 10",
      band: band(wingIndex, 2, 4, false),
      detail: "Wing deformity signature associated with high mite pressure.",
      benchmark: "Investigate above 2",
    },
  ];
  const findings: ScanFinding[] = detections
    .filter((d) => d.probability >= 0.22)
    .slice(0, 4)
    .map((d, index) => ({
      id: d.name.toLowerCase().replaceAll(" ", "-"),
      title: `${d.name} · ${Math.round(d.probability * 100)}% match`,
      severity: d.severity,
      confidence: d.probability,
      detail: `${d.trigger}. Signature appears on roughly ${d.affectedFrames}% of the sampled frames.`,
      action: `${d.action} Treatment window: ${d.window}.`,
      frame: index % Math.max(1, context.frameCount),
      region: region(random),
    }));
  if (!findings.length)
    findings.push({
      id: "clear",
      title: "No disease signature above the reporting threshold",
      severity: "INFO",
      confidence: round(0.7 + random() * 0.2, 2),
      detail:
        "Brood pattern, entrance traffic and comb condition all read within the normal range for this colony.",
      action: "Keep the monthly scan cadence.",
      frame: 0,
      region: region(random),
    });
  const score = Math.round(
    clamp(
      detections[0].probability * 62 +
        detections[1].probability * 20 +
        Math.max(0, miteLoad - 3) * 5 +
        Math.max(0, 85 - broodPattern) * 0.4,
      3,
      97,
    ),
  );
  return {
    score,
    headline: {
      label: "Colony disease pressure",
      value: score,
      unit: "/ 100",
    },
    title:
      score <= 30
        ? "No disease pressure worth acting on."
        : score <= 70
          ? "Early disease signatures — act this fortnight."
          : "High disease pressure. Inspect this colony now.",
    summary: `The strongest signature is ${detections[0].name} at ${Math.round(detections[0].probability * 100)}% with an estimated ${miteLoad} mites per 100 bees and ${broodPattern}% brood pattern regularity.`,
    metrics,
    findings,
    recommendations: [
      detections[0].action,
      broodPattern < 85
        ? "Check queen performance; the brood pattern is patchy across the sampled frames."
        : "Keep recording inspections so the batch risk engine sees harvest-time colony context.",
      "Re-scan after treatment to confirm the signature has fallen.",
    ],
    expected: detections,
    frames: frameNotes(random, context, [
      "Brood frame, both faces",
      "Landing board traffic",
      "Frame rail and floor debris",
      "Stored comb",
    ]),
  };
}
function digitalTwin(random: () => number, context: ScanContext): ModeResult {
  const sensorWeight = context.hive?.weight ?? null;
  const health = context.hive?.healthScore ?? 72;
  const boxes =
    sensorWeight && sensorWeight > 42
      ? 3
      : sensorWeight && sensorWeight > 30
        ? 2
        : 2;
  const frames = boxes * 10;
  const combCoverage = Math.round(
    clamp(58 + health * 0.32 + random() * 16, 40, 97),
  );
  const occupiedFrames = Math.max(4, Math.round((frames * combCoverage) / 100));
  const frameMap: TwinFrame[] = Array.from({ length: frames }, (_, index) => {
    const position = index / frames;
    const occupied = index < occupiedFrames;
    const role: TwinFrame["role"] = !occupied
      ? "EMPTY"
      : position < 0.22
        ? "HONEY"
        : position < 0.36
          ? "POLLEN"
          : position < 0.72
            ? "BROOD"
            : "HONEY";
    return {
      index,
      role,
      coverage: occupied
        ? Math.round(clamp(52 + random() * 48, 30, 100))
        : Math.round(random() * 18),
      capped: occupied ? Math.round(clamp(40 + random() * 58, 10, 99)) : 0,
    };
  });
  const honeyFrames = frameMap.filter((f) => f.role === "HONEY");
  const broodFrames = frameMap.filter((f) => f.role === "BROOD");
  const pollenFrames = frameMap.filter((f) => f.role === "POLLEN");
  const honeyStores = round(
    honeyFrames.reduce((sum, f) => sum + (f.coverage / 100) * 2.4, 0),
    1,
  );
  const pollenStores = round(
    pollenFrames.reduce((sum, f) => sum + (f.coverage / 100) * 1.1, 0),
    1,
  );
  const broodAreaCm2 = Math.round(
    broodFrames.reduce((sum, f) => sum + (f.coverage / 100) * 880, 0),
  );
  const population =
    Math.round((broodAreaCm2 * 3.9 + occupiedFrames * 1100) / 100) * 100;
  const woodwork = round(boxes * 4.6 + 3.2, 1);
  const combWax = round(frames * 0.32, 1);
  const beeMass = round(population * 0.00011, 1);
  const modelled = round(
    woodwork + combWax + beeMass + honeyStores + pollenStores,
    1,
  );
  const weightDelta =
    sensorWeight === null ? null : round(modelled - sensorWeight, 1);
  const weight = [
    { component: "Boxes, frames and floor", kilograms: woodwork },
    { component: "Drawn comb", kilograms: combWax },
    { component: "Bees", kilograms: beeMass },
    { component: "Honey stores", kilograms: honeyStores },
    { component: "Pollen stores", kilograms: pollenStores },
  ];
  const diseaseModel = disease(random, context);
  const trend = context.weightTrend ?? round(0.18 + random() * 0.42, 2);
  const projections = [30, 60, 90].map((horizonDays) => {
    const seasonal = 1 - horizonDays / 420;
    const expectedWeight = round(modelled + trend * horizonDays * seasonal, 1);
    return {
      horizonDays,
      expectedWeight,
      expectedYield: round(Math.max(0, (expectedWeight - modelled) * 0.72), 1),
      riskScore: Math.round(
        clamp(diseaseModel.score + horizonDays * 0.12 - health * 0.08, 4, 96),
      ),
      note:
        horizonDays === 30
          ? "Next brood cycle at the current forage rate."
          : horizonDays === 60
            ? "Approaching the extraction window if the flow holds."
            : "Late-season outlook including a reduced flow.",
    };
  });
  const twin: DigitalTwin = {
    boxes,
    frames,
    occupiedFrames,
    combCoverage,
    population,
    broodAreaCm2,
    honeyStores,
    pollenStores,
    queenStatus:
      diseaseModel.metrics[1].value >= 85
        ? "Laying well, continuous pattern"
        : "Patchy pattern — verify the queen",
    estimatedWeight: modelled,
    sensorWeight,
    weightDelta,
    weight,
    frameMap,
    projections,
    expectedDiseases: diseaseModel.expected.slice(0, 4).map((d) => ({
      name: d.name,
      probability: d.probability,
      window: d.window,
      trigger: d.trigger,
    })),
  };
  const metrics: ScanMetric[] = [
    {
      key: "modelled_weight",
      label: "Modelled hive weight",
      value: modelled,
      unit: "kg",
      band:
        weightDelta === null
          ? "good"
          : band(Math.abs(weightDelta), 1.5, 3, false),
      detail:
        sensorWeight === null
          ? "Reconstructed from box count, comb coverage and stores."
          : `Load-cell reading is ${sensorWeight} kg — a ${weightDelta! >= 0 ? "+" : ""}${weightDelta} kg difference.`,
      benchmark: "Within ±1.5 kg of the sensor",
    },
    {
      key: "comb_coverage",
      label: "Comb coverage",
      value: combCoverage,
      unit: "%",
      band: band(combCoverage, 75, 55),
      detail: `${occupiedFrames} of ${frames} frames are drawn and occupied.`,
      benchmark: "Strong colony above 75%",
    },
    {
      key: "population",
      label: "Population estimate",
      value: population,
      unit: "bees",
      band: band(population, 22000, 14000),
      detail: "Derived from sealed brood area and occupied frame count.",
      benchmark: "Productive above 22,000",
    },
    {
      key: "brood_area",
      label: "Sealed brood area",
      value: broodAreaCm2,
      unit: "cm²",
      band: band(broodAreaCm2, 2400, 1400),
      detail: "Summed sealed brood across both faces of the brood frames.",
      benchmark: "Healthy above 2,400 cm²",
    },
    {
      key: "stores",
      label: "Honey stores",
      value: honeyStores,
      unit: "kg",
      band: band(honeyStores, 12, 7),
      detail: `Plus ${pollenStores} kg of pollen across ${pollenFrames.length} frames.`,
      benchmark: "Overwintering needs 12 kg+",
    },
  ];
  const findings: ScanFinding[] = [
    {
      id: "structure",
      title: `${boxes} boxes · ${occupiedFrames} of ${frames} frames drawn`,
      severity: combCoverage < 60 ? "WATCH" : "INFO",
      confidence: round(0.76 + random() * 0.16, 2),
      detail: `The reconstruction places ${broodFrames.length} brood frames in the centre with honey on the outer positions.`,
      action:
        combCoverage < 60
          ? "Reduce the box count until the colony draws the remaining frames."
          : "Add a super before the stores frames are fully capped.",
      frame: 0,
      region: region(random),
    },
    ...(weightDelta !== null && Math.abs(weightDelta) > 1.5
      ? [
          {
            id: "weight_gap",
            title: `Modelled weight differs from the load cell by ${weightDelta} kg`,
            severity: "WATCH" as const,
            confidence: round(0.6 + random() * 0.2, 2),
            detail:
              "The visual reconstruction and the sensor disagree. One of them is looking at a hive that changed since the last reading.",
            action: "Re-weigh the hive and re-scan to reconcile the twin.",
            frame: Math.min(1, context.frameCount - 1),
            region: region(random),
          },
        ]
      : []),
    {
      id: "projection",
      title: `Projected ${projections[1].expectedWeight} kg in 60 days`,
      severity: "INFO",
      confidence: round(0.58 + random() * 0.22, 2),
      detail: `At the current gain of ${trend} kg per day the twin expects roughly ${projections[1].expectedYield} kg of extractable honey by then.`,
      action: "Plan the extraction window against this projection.",
      frame: Math.min(2, Math.max(0, context.frameCount - 1)),
      region: region(random),
    },
  ];
  const score = Math.round(
    clamp(
      (100 - combCoverage) * 0.42 +
        diseaseModel.score * 0.35 +
        Math.max(0, 12 - honeyStores) * 2.1 +
        (weightDelta === null ? 4 : Math.min(12, Math.abs(weightDelta) * 2.4)),
      4,
      96,
    ),
  );
  return {
    score,
    headline: {
      label: "Twin structural health",
      value: 100 - score,
      unit: "/ 100",
    },
    title: `A ${boxes}-box twin weighing ${modelled} kg.`,
    summary: `The twin reconstructs ${occupiedFrames} drawn frames, about ${population.toLocaleString("en-IN")} bees and ${honeyStores} kg of stores, modelling ${modelled} kg against ${sensorWeight === null ? "no load-cell reading" : `${sensorWeight} kg on the load cell`}.`,
    metrics,
    findings,
    recommendations: [
      `Expect roughly ${projections[0].expectedYield} kg of extractable honey in 30 days.`,
      twin.expectedDiseases[0]
        ? `Watch for ${twin.expectedDiseases[0].name} within ${twin.expectedDiseases[0].window} — ${twin.expectedDiseases[0].trigger.toLowerCase()}.`
        : "No disease signature is projected within 90 days.",
      honeyStores < 12
        ? "Stores are below the overwintering target — plan supplementary feeding."
        : "Stores are on track for overwintering.",
    ],
    twin,
    frames: frameNotes(random, context, [
      "Full hive exterior",
      "Open brood chamber",
      "Frame-by-frame sweep",
      "Super and stores",
    ]),
  };
}
export function simulateScan(
  mode: ScanMode,
  captureDigest: string,
  context: ScanContext,
): ScanReport {
  const random = seeded(`${captureDigest}:${mode}`);
  const result =
    mode === "HONEY_QUALITY"
      ? honeyQuality(random, context)
      : mode === "ENVIRONMENT"
        ? environment(random, context)
        : mode === "DISEASE"
          ? disease(random, context)
          : digitalTwin(random, context);
  return {
    mode,
    score: result.score,
    classification: classification(result.score),
    confidence: confidenceFor(context, mode === "ENVIRONMENT" ? 0.58 : 0.64),
    headline: result.headline,
    title: result.title,
    summary: result.summary,
    metrics: result.metrics,
    findings: result.findings,
    recommendations: result.recommendations,
    twin: result.twin,
    placement: result.placement,
    frames: result.frames,
    engine: SCAN_ENGINE_VERSION,
    timestamp: context.now ?? new Date().toISOString(),
    scope: SCAN_SCOPE,
    simulated: true,
  };
}
