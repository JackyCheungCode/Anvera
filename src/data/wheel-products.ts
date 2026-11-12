export type WheelDevelopmentProduct = {
  slug: string;
  title: string;
  modelCode: string;
  constructionType: "monoblock" | "two_piece" | "three_piece";
  family: string;
  material: string;
  manufacturingProcess: string;
  designStyle: string;
  shortDescription: string;
  designStory: string;
  diameterOptions: string[];
  widthOptions: string[];
  pcdOptions: string[];
  offsetRange: string;
  centreBoreOptions: string[];
  finishOptions: string[];
  intendedUse: string[];
  specificationStatus: string;
  developmentOnly: true;
};

export const wheelDevelopmentProducts: WheelDevelopmentProduct[] = [
  {
    slug: "av01-vector",
    title: "VECTOR",
    modelCode: "AV01",
    constructionType: "monoblock",
    family: "Performance Series",
    material: "Forged aluminium alloy (development specification)",
    manufacturingProcess: "Forging blank, CNC machining, deburring, surface preparation and finish inspection.",
    designStyle: "Directional multi-spoke with a motorsport-led, lightweight visual language.",
    shortDescription: "A purposeful multi-spoke design developed around a clean, performance-focused silhouette.",
    designStory: "VECTOR uses a directional spoke layout to create a sense of forward movement while keeping the centre architecture visually precise. Its restrained surfaces are intended to work across modern performance saloons, coupes and sports cars.",
    diameterOptions: ["19 in", "20 in", "21 in"],
    widthOptions: ["8.5J", "9.0J", "9.5J", "10.0J", "10.5J", "11.0J"],
    pcdOptions: ["5x112", "5x114.3", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; engineering confirmation required",
    centreBoreOptions: ["Vehicle-specific hub bore", "Bespoke centre bore on request"],
    finishOptions: ["Satin black", "Brushed titanium", "Gloss graphite", "Custom colour"],
    intendedUse: ["Performance road", "Grand touring"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av02-strata",
    title: "STRATA",
    modelCode: "AV02",
    constructionType: "monoblock",
    family: "Performance Series",
    material: "Forged aluminium alloy (development specification)",
    manufacturingProcess: "Forged monoblock blank with CNC-machined spoke faces and precision-finished pockets.",
    designStyle: "Split-spoke geometry with layered surfaces and a technical, architectural character.",
    shortDescription: "Layered split spokes bring depth and definition to a contemporary forged monoblock.",
    designStory: "STRATA is shaped around the contrast between broad spoke faces and carefully recessed details. The layered geometry gives the wheel a strong three-dimensional presence without relying on decorative excess.",
    diameterOptions: ["19 in", "20 in", "21 in", "22 in"],
    widthOptions: ["8.5J", "9.0J", "9.5J", "10.0J", "10.5J", "11.0J", "12.0J"],
    pcdOptions: ["5x112", "5x114.3", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; engineering confirmation required",
    centreBoreOptions: ["Vehicle-specific hub bore", "Bespoke centre bore on request"],
    finishOptions: ["Gloss black", "Satin titanium", "Brushed clear", "Custom colour"],
    intendedUse: ["Luxury performance", "Street"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av03-vantage",
    title: "VANTAGE",
    modelCode: "AV03",
    constructionType: "monoblock",
    family: "Performance Series",
    material: "Forged aluminium alloy (development specification)",
    manufacturingProcess: "Monoblock forging followed by multi-axis CNC machining and finish-specific surface treatment.",
    designStyle: "Five twin-spoke structure with a strong centre and open brake-visibility windows.",
    shortDescription: "A confident twin-spoke profile balancing muscular proportions with precise detailing.",
    designStory: "VANTAGE gives the five-spoke format a sharper, more technical expression. Its open architecture places emphasis on the brake package and the relationship between the spoke, rim and hub.",
    diameterOptions: ["19 in", "20 in", "21 in"],
    widthOptions: ["8.5J", "9.0J", "9.5J", "10.0J", "10.5J", "11.0J"],
    pcdOptions: ["5x112", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; engineering confirmation required",
    centreBoreOptions: ["Vehicle-specific hub bore"],
    finishOptions: ["Satin black", "Gloss silver", "Brushed smoke", "Custom colour"],
    intendedUse: ["Performance road", "Track-inspired road"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av04-monolith",
    title: "MONOLITH",
    modelCode: "AV04",
    constructionType: "monoblock",
    family: "Signature Series",
    material: "Forged aluminium alloy (development specification)",
    manufacturingProcess: "Single-piece forging, precision CNC finishing and controlled cosmetic inspection.",
    designStyle: "Dense geometric spoke pattern with a refined, sculptural centre section.",
    shortDescription: "A sculptural monoblock design for understated luxury and strong visual presence.",
    designStory: "MONOLITH explores a more substantial spoke architecture. Carefully controlled transitions from the hub to the outer rim create a composed, premium appearance suited to larger luxury platforms.",
    diameterOptions: ["20 in", "21 in", "22 in"],
    widthOptions: ["9.0J", "9.5J", "10.0J", "10.5J", "11.0J", "12.0J"],
    pcdOptions: ["5x112", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; engineering confirmation required",
    centreBoreOptions: ["Vehicle-specific hub bore", "Bespoke centre bore on request"],
    finishOptions: ["Satin platinum", "Polished silver", "Gloss black", "Custom colour"],
    intendedUse: ["Luxury SUV", "Luxury saloon"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av05-aeroform",
    title: "AEROFORM",
    modelCode: "AV05",
    constructionType: "monoblock",
    family: "Performance Series",
    material: "Forged aluminium alloy (development specification)",
    manufacturingProcess: "Forged monoblock construction with CNC-machined aerodynamic spoke reliefs.",
    designStyle: "Aero-inspired directional spokes with a smooth, contemporary face profile.",
    shortDescription: "An aerodynamic visual study with flowing spokes and a clean, modern face.",
    designStory: "AEROFORM takes inspiration from airflow and surface continuity. The spoke transitions are designed to read as a single flowing form, giving the wheel a distinctive identity from both a static and rolling perspective.",
    diameterOptions: ["19 in", "20 in", "21 in"],
    widthOptions: ["8.5J", "9.0J", "9.5J", "10.0J", "10.5J"],
    pcdOptions: ["5x112", "5x114.3", "5x120"],
    offsetRange: "Vehicle-specific; engineering confirmation required",
    centreBoreOptions: ["Vehicle-specific hub bore"],
    finishOptions: ["Satin graphite", "Brushed aluminium", "Gloss black", "Custom colour"],
    intendedUse: ["Sport sedan", "Electric performance"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av06-forma",
    title: "FORMA",
    modelCode: "AV06",
    constructionType: "two_piece",
    family: "Atelier Series",
    material: "Forged aluminium centre with configurable outer assembly (development specification)",
    manufacturingProcess: "Separately machined centre and rim components, assembled to a vehicle-specific engineering brief.",
    designStyle: "Classic multi-spoke centre with a configurable rim and hardware expression.",
    shortDescription: "A two-piece platform that opens up more possibilities for depth, finish and proportion.",
    designStory: "FORMA is designed as a flexible canvas. Its two-piece architecture allows the visual relationship between centre, rim and hardware to be tuned to the vehicle and the customer's preferred stance.",
    diameterOptions: ["19 in", "20 in", "21 in", "22 in"],
    widthOptions: ["8.5J", "9.0J", "9.5J", "10.0J", "10.5J", "11.0J", "12.0J"],
    pcdOptions: ["5x112", "5x114.3", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; component configuration and engineering review required",
    centreBoreOptions: ["Vehicle-specific hub bore"],
    finishOptions: ["Brushed centre / polished lip", "Satin black / gloss lip", "Custom centre and rim finish"],
    intendedUse: ["Luxury performance", "Bespoke street"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av07-spline",
    title: "SPLINE",
    modelCode: "AV07",
    constructionType: "two_piece",
    family: "Atelier Series",
    material: "Forged aluminium centre with configurable outer assembly (development specification)",
    manufacturingProcess: "CNC-machined forged centre, configurable rim profile and finish-matched assembly.",
    designStyle: "Fine multi-spoke layout with a deep, technical centre profile.",
    shortDescription: "A detailed multi-spoke design for projects where precision and individuality matter.",
    designStory: "SPLINE uses a fine spoke rhythm to create visual complexity while preserving a disciplined overall form. The two-piece construction gives the design room for a more individual rim and finish combination.",
    diameterOptions: ["19 in", "20 in", "21 in", "22 in"],
    widthOptions: ["8.5J", "9.0J", "9.5J", "10.0J", "10.5J", "11.0J", "12.0J"],
    pcdOptions: ["5x112", "5x114.3", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; component configuration and engineering review required",
    centreBoreOptions: ["Vehicle-specific hub bore", "Bespoke centre bore on request"],
    finishOptions: ["Brushed titanium", "Satin black", "Polished outer lip", "Custom combination"],
    intendedUse: ["Grand touring", "Bespoke luxury"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av08-quantum",
    title: "QUANTUM",
    modelCode: "AV08",
    constructionType: "two_piece",
    family: "Atelier Series",
    material: "Forged aluminium centre with configurable outer assembly (development specification)",
    manufacturingProcess: "Forged centre machining, precision outer assembly and project-specific finishing.",
    designStyle: "Angular split-spoke structure with a strong concave visual direction.",
    shortDescription: "A bold two-piece design built around contrast, depth and a pronounced centre profile.",
    designStory: "QUANTUM is a more expressive interpretation of the split-spoke format. Its contrasting planes create a technical, layered appearance that can be adapted through rim and finish choices.",
    diameterOptions: ["20 in", "21 in", "22 in"],
    widthOptions: ["9.0J", "9.5J", "10.0J", "10.5J", "11.0J", "12.0J"],
    pcdOptions: ["5x112", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; component configuration and engineering review required",
    centreBoreOptions: ["Vehicle-specific hub bore"],
    finishOptions: ["Gloss black", "Brushed dark clear", "Satin platinum", "Custom combination"],
    intendedUse: ["Luxury SUV", "High-performance coupe"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av09-radius",
    title: "RADIUS",
    modelCode: "AV09",
    constructionType: "three_piece",
    family: "Atelier Series",
    material: "Forged aluminium centre and configurable multi-piece rim assembly (development specification)",
    manufacturingProcess: "Individually machined centre and rim components, assembled and inspected to an approved project specification.",
    designStyle: "Open five-spoke architecture with classic multi-piece detailing.",
    shortDescription: "A timeless five-spoke foundation for highly individual multi-piece wheel projects.",
    designStory: "RADIUS pairs a clean five-spoke face with the expressive detail of a multi-piece assembly. It is intended for projects where rim profile, hardware and finish are as important as the centre design.",
    diameterOptions: ["18 in", "19 in", "20 in", "21 in", "22 in"],
    widthOptions: ["8.0J", "8.5J", "9.0J", "9.5J", "10.0J", "10.5J", "11.0J", "12.0J"],
    pcdOptions: ["5x112", "5x114.3", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; multi-piece assembly and engineering review required",
    centreBoreOptions: ["Vehicle-specific hub bore"],
    finishOptions: ["Brushed centre / polished lip", "Satin centre / polished hardware", "Custom multi-finish"],
    intendedUse: ["Classic performance", "Bespoke restoration"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  },
  {
    slug: "av10-forged-gt",
    title: "FORGED GT",
    modelCode: "AV10",
    constructionType: "three_piece",
    family: "Atelier Series",
    material: "Forged aluminium centre and configurable multi-piece rim assembly (development specification)",
    manufacturingProcess: "Project-specific component machining, rim assembly, hardware selection and final quality inspection.",
    designStyle: "Motorsport-inspired split-six spoke with configurable deep-rim proportions.",
    shortDescription: "A motorsport-inspired multi-piece platform for a fully considered bespoke specification.",
    designStory: "FORGED GT brings a competition-influenced spoke design into a configurable multi-piece format. Centre finish, outer rim treatment and hardware details can be developed as one coherent project.",
    diameterOptions: ["18 in", "19 in", "20 in", "21 in"],
    widthOptions: ["8.0J", "8.5J", "9.0J", "9.5J", "10.0J", "10.5J", "11.0J"],
    pcdOptions: ["5x112", "5x114.3", "5x120", "5x130"],
    offsetRange: "Vehicle-specific; multi-piece assembly and engineering review required",
    centreBoreOptions: ["Vehicle-specific hub bore", "Bespoke centre bore on request"],
    finishOptions: ["Satin black / polished lip", "Brushed titanium / gloss lip", "Custom multi-finish"],
    intendedUse: ["Track-inspired road", "Bespoke performance"],
    specificationStatus: "Illustrative development data only — not approved for production or vehicle fitment.",
    developmentOnly: true
  }
];

export const getWheelDevelopmentProduct = (slug: string) =>
  wheelDevelopmentProducts.find((product) => product.slug === slug) ?? null;
