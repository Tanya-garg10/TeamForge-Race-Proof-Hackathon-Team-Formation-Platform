import aiSystemsImg from '@/src/assets/images/hackathon_ai_systems_1794678733550.jpg';
import climateGridImg from '@/src/assets/images/hackathon_climate_grid_1794678733334.jpg';
import fintechLedgerImg from '@/src/assets/images/hackathon_fintech_ledger_1794684837393.jpg';
import bioComputeImg from '@/src/assets/images/hackathon_bio_compute_1794684837811.jpg';
import edgeRoboticsImg from '@/src/assets/images/hackathon_edge_robotics_1794684837668.jpg';
import type { Hackathon } from '@/shared/types';

const HACKATHON_BANNER_BY_ID: Record<string, string> = {
  hack_ai_systems: aiSystemsImg,
  hack_climate_grid: climateGridImg,
  hack_fintech_zero: fintechLedgerImg,
  hack_bio_compute: bioComputeImg,
  hack_edge_robotics: edgeRoboticsImg,
};

const THEME_FALLBACKS = [
  { match: 'climate', img: climateGridImg },
  { match: 'fintech', img: fintechLedgerImg },
  { match: 'bio', img: bioComputeImg },
  { match: 'robot', img: edgeRoboticsImg },
  { match: 'ai', img: aiSystemsImg },
];

export function getHackathonBanner(hackathon: Pick<Hackathon, 'id' | 'theme' | 'bannerUrl'>): string {
  if (HACKATHON_BANNER_BY_ID[hackathon.id]) {
    return HACKATHON_BANNER_BY_ID[hackathon.id];
  }
  const lowerTheme = hackathon.theme.toLowerCase();
  const matched = THEME_FALLBACKS.find((entry) => lowerTheme.includes(entry.match));
  if (matched) return matched.img;
  return hackathon.bannerUrl || aiSystemsImg;
}
