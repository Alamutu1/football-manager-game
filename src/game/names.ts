/**
 * Fictional name pools. Every name here is invented; no real footballer
 * or real club is referenced anywhere in the game data.
 */

export const FIRST_NAMES = [
  'Tomas', 'Luka', 'Andre', 'Marco', 'Felix', 'Omar', 'Dario', 'Ivan',
  'Ruben', 'Mateo', 'Karim', 'Stefan', 'Nils', 'Paolo', 'Yusuf', 'Emil',
  'Victor', 'Hugo', 'Denis', 'Arman', 'Tariq', 'Jonas', 'Petr', 'Sami',
  'Rory', 'Dante', 'Iker', 'Milan', 'Oscar', 'Bruno', 'Kenji', 'Rafael',
  'Dmitri', 'Leo', 'Ansel', 'Farid', 'Casper', 'Theo', 'Malik', 'Jordi',
] as const;

export const LAST_NAMES = [
  'Novak', 'Ferrer', 'Kovac', 'Diallo', 'Marino', 'Berg', 'Costa', 'Haddad',
  'Larsen', 'Petrov', 'Okafor', 'Silva', 'Marek', 'Tanaka', 'Reyes', 'Adeyemi',
  'Fischer', 'Dubois', 'Khan', 'Moreau', 'Nagy', 'Santos', 'Vidal', 'Osei',
  'Lindqvist', 'Barros', 'Ilic', 'Nguyen', 'Fontaine', 'Rossi', 'Mensah',
  'Keller', 'Almeida', 'Varga', 'Toure', 'Lombardi', 'Weber', 'Castillo',
  'Haugen', 'Benali',
] as const;

export interface ClubSeed {
  name: string;
  shortName: string;
  primaryColor: string;
  /** Base squad strength, 55-80. Higher means a stronger starting squad. */
  strength: number;
  /** Starting funds. Stronger clubs start richer, as in real football. */
  funds: number;
}

export const CLUB_SEEDS: ClubSeed[] = [
  { name: 'Royal Oaks', shortName: 'OAK', primaryColor: '#1B5E20', strength: 78, funds: 42000000 },
  { name: 'Harbour United', shortName: 'HAR', primaryColor: '#0D47A1', strength: 76, funds: 38000000 },
  { name: 'Northgate FC', shortName: 'NOR', primaryColor: '#B71C1C', strength: 74, funds: 34000000 },
  { name: 'Ironworks Athletic', shortName: 'IRN', primaryColor: '#37474F', strength: 72, funds: 30000000 },
  { name: 'Crescent Rovers', shortName: 'CRE', primaryColor: '#4A148C', strength: 71, funds: 28000000 },
  { name: 'Falcon City', shortName: 'FAL', primaryColor: '#E65100', strength: 70, funds: 26000000 },
  { name: 'Blue Anchor', shortName: 'ANC', primaryColor: '#006064', strength: 69, funds: 24000000 },
  { name: 'Summit Town', shortName: 'SUM', primaryColor: '#33691E', strength: 68, funds: 22000000 },
  { name: 'Riverdale FC', shortName: 'RIV', primaryColor: '#01579B', strength: 67, funds: 20000000 },
  { name: 'Kingsport United', shortName: 'KIN', primaryColor: '#880E4F', strength: 66, funds: 19000000 },
  { name: 'Meadow Park', shortName: 'MEA', primaryColor: '#2E7D32', strength: 65, funds: 18000000 },
  { name: 'Stormhaven', shortName: 'STO', primaryColor: '#263238', strength: 64, funds: 17000000 },
  { name: 'Old Castle', shortName: 'CAS', primaryColor: '#4E342E', strength: 63, funds: 16000000 },
  { name: 'Lakeside Rovers', shortName: 'LAK', primaryColor: '#00838F', strength: 62, funds: 15000000 },
  { name: 'Desert Stars', shortName: 'DES', primaryColor: '#BF360C', strength: 60, funds: 14000000 },
  { name: 'Coastal Athletic', shortName: 'COA', primaryColor: '#00695C', strength: 58, funds: 12000000 },
];
