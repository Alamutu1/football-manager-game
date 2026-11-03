/**
 * D5 season membership: the 2024-25 top-flight set, 96 clubs.
 *
 * Derived from the openfootball 2024-25 team lists bundled in the
 * v1 pack, resolved by pack club id to the player-carrying entity
 * (so Toulouse is wd:Q19518, not the zero-player duplicate
 * wd:Q2422417, and FC Augsburg is wd:Q15755, not wd:Q97905916).
 * Every listed club has at least 18 recorded players.
 *
 * This is a frozen starting membership, not a claim about 2026-27:
 * it includes clubs relegated after 2024-25 (Leicester, Ipswich,
 * Southampton). The UI must label it "2024-25 top-flight
 * membership" and fixtures as "game-generated season fixtures, NOT
 * the real 2024-25 schedule/results". Promotion and relegation are
 * a future phase, not D5.
 */

export const SEASON_MEMBERSHIP_VERSION = 'd5-membership-v1';

/** League id -> member club ids, in a fixed order. */
export const SEASON_MEMBERSHIP: Record<string, string[]> = {
  // Premier League, England: 20 clubs, 38 rounds, 380 matches.
  'wd:Q9448': [
    'wd:Q19568', // AFC Bournemouth
    'wd:Q9617', // Arsenal F.C.
    'wd:Q18711', // Aston Villa F.C.
    'wd:Q19571', // Brentford F.C.
    'wd:Q19453', // Brighton & Hove Albion F.C.
    'wd:Q9616', // Chelsea F.C.
    'wd:Q19467', // Crystal Palace F.C.
    'wd:Q5794', // Everton F.C.
    'wd:Q18708', // Fulham F.C.
    'wd:Q9653', // Ipswich Town F.C.
    'wd:Q19481', // Leicester City F.C.
    'wd:Q1130849', // Liverpool F.C.
    'wd:Q50602', // Manchester City F.C.
    'wd:Q18656', // Manchester United F.C.
    'wd:Q18716', // Newcastle United F.C.
    'wd:Q19490', // Nottingham Forest F.C.
    'wd:Q18732', // Southampton F.C.
    'wd:Q18741', // Tottenham Hotspur F.C.
    'wd:Q18747', // West Ham United F.C.
    'wd:Q19500', // Wolverhampton Wanderers F.C.
  ],
  // La Liga, Spain: 20 clubs, 38 rounds, 380 matches.
  'wd:Q324867': [
    'wd:Q8687', // Athletic Club
    'wd:Q8701', // Atlético Madrid
    'wd:Q7156', // FC Barcelona
    'wd:Q8749', // RC Celta de Vigo
    'wd:Q223620', // Deportivo Alavés
    'wd:Q8780', // RCD Espanyol de Barcelona
    'wd:Q8806', // Getafe CF
    'wd:Q11945', // Girona FC
    'wd:Q856119', // CD Leganés
    'wd:Q8835', // RCD Mallorca
    'wd:Q10286', // Club Atlético Osasuna
    'wd:Q10300', // Rayo Vallecano
    'wd:Q8723', // Real Betis Balompié
    'wd:Q8682', // Real Madrid Club de Fútbol
    'wd:Q10315', // Real Sociedad
    'wd:Q10319', // Real Valladolid
    'wd:Q10329', // Sevilla FC
    'wd:Q11979', // UD Las Palmas
    'wd:Q10333', // Valencia CF
    'wd:Q12297', // Villarreal CF
  ],
  // Serie A, Italy: 20 clubs, 38 rounds, 380 matches.
  'wd:Q15804': [
    'wd:Q1543', // AC Milan
    'wd:Q289482', // AC Monza
    'wd:Q2052', // ACF Fiorentina
    'wd:Q2739', // AS Roma
    'wd:Q1886', // Atalanta BC
    'wd:Q1893', // Bologna F.C. 1909
    'wd:Q1900', // Cagliari Calcio
    'wd:Q1120838', // Como 1907
    'wd:Q6703', // Empoli FC
    'wd:Q2074', // Genoa CFC
    'wd:Q8639', // Hellas Verona FC
    'wd:Q631', // Inter Milan
    'wd:Q1422', // Juventus FC
    'wd:Q13391', // US Lecce
    'wd:Q2641', // SSC Napoli
    'wd:Q2693', // Parma Calcio 1913
    'wd:Q2609', // SS Lazio
    'wd:Q2768', // Torino FC
    'wd:Q2798', // Udinese Calcio
    'wd:Q501245', // Venezia F.C.
  ],
  // Bundesliga, Germany: 18 clubs, 34 rounds, 306 matches.
  'wd:Q82595': [
    'wd:Q162251', // 1. FC Heidenheim 1846
    'wd:Q141971', // 1. FC Union Berlin
    'wd:Q105254', // 1. FSV Mainz 05
    'wd:Q104761', // Bayer 04 Leverkusen
    'wd:Q41420', // Borussia Dortmund
    'wd:Q101959', // Borussia Mönchengladbach
    'wd:Q38245', // Eintracht Frankfurt
    'wd:Q15755', // FC Augsburg (player-carrying entity)
    'wd:Q15789', // FC Bayern Munich
    'wd:Q6463', // FC St. Pauli
    'wd:Q157828', // Holstein Kiel
    'wd:Q702455', // RB Leipzig
    'wd:Q106394', // SC Freiburg
    'wd:Q51976', // SV Werder Bremen
    'wd:Q22707', // TSG 1899 Hoffenheim
    'wd:Q4512', // VfB Stuttgart
    'wd:Q105861', // VfL Bochum
    'wd:Q101859', // VfL Wolfsburg
  ],
  // Ligue 1, France: 18 clubs, 34 rounds, 306 matches.
  'wd:Q13394': [
    'wd:Q182876', // AJ Auxerre
    'wd:Q845137', // Angers SCO
    'wd:Q180305', // AS Monaco FC
    'wd:Q19521', // AS Saint-Étienne
    'wd:Q192071', // FC Nantes
    'wd:Q328658', // Le Havre AC
    'wd:Q19516', // Lille OSC
    'wd:Q19513', // Montpellier Hérault Sport Club
    'wd:Q185163', // OGC Nice
    'wd:Q704', // Olympique Lyonnais
    'wd:Q132885', // Olympique de Marseille
    'wd:Q483020', // Paris Saint-Germain FC
    'wd:Q126334', // RC Strasbourg Alsace
    'wd:Q191843', // R.C. Lens
    'wd:Q218372', // Stade Brestois 29
    'wd:Q208228', // Stade de Reims
    'wd:Q19509', // Stade Rennais F.C.
    'wd:Q19518', // Toulouse FC (player-carrying entity)
  ],
};

/** Member club ids for a league, or null when the league has no season. */
export function membershipFor(leagueId: string): string[] | null {
  const ids = SEASON_MEMBERSHIP[leagueId];
  return ids ? [...ids] : null;
}

/** The season league a club belongs to, or null for non-members. */
export function seasonLeagueOfClub(clubId: string): string | null {
  for (const [leagueId, ids] of Object.entries(SEASON_MEMBERSHIP)) {
    if (ids.includes(clubId)) return leagueId;
  }
  return null;
}

/** Total member clubs across all five leagues (96). */
export function totalMembershipClubs(): number {
  return Object.values(SEASON_MEMBERSHIP).reduce((sum, ids) => sum + ids.length, 0);
}
