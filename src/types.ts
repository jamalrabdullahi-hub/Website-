export interface ResourceSector {
  id: string;
  name: string;
  title: string;
  description: string;
  detailedDescription: string;
  resources: string[];
  keyRegions: string[];
  image: string;
  metrics: { label: string; value: string }[];
  opportunities: string[];
  geologicalContext: string;
}

export interface SomaliaRegion {
  id: string;
  name: string;
  capital: string;
  primarySectors: string[];
  resources: string[];
  description: string;
  svgPath: string; // Used for rendering the interactive map
  centerCoordinates: { x: number; y: number }; // For placing label pins
}

export interface Inquiry {
  id: string;
  type: "investor" | "operator" | "general";
  companyName: string;
  contactName: string;
  email: string;
  sector: string;
  capital: string;
  message: string;
  status: "Under Review" | "Partner Matched" | "Information Requested" | "Approved";
  submittedAt: string;
  responseCount: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface PartnershipPhase {
  step: number;
  title: string;
  duration: string;
  description: string;
  deliverables: string[];
  actors: string;
}
