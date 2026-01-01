export interface User {
  id: number;
  email: string;
  role: 'user' | 'admin';
  token?: string;
}

export interface LandingPageContent {
  headline: string;
  subheadline: string;
  ctaText: string;
  benefits: { title: string; description: string }[];
  testimonials: { name: string; role: string; quote: string }[];
  colors: { primary: string; secondary: string; background: string; text: string };
}

export interface LandingPage {
  id: number;
  user_id: number;
  title: string;
  slug: string;
  content: LandingPageContent;
  created_at: string;
}

export interface GeneratorParams {
  companyName: string;
  niche: string;
  targetAudience: string;
  goal: string;
}
