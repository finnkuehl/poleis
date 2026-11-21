// Alle Zahlen der Kartengenerierung (siehe docs/GAME_DESIGN.md, Abschnitt 3).
// Du kannst sie selbst ändern: Zahl anpassen, speichern, Spiel neu laden.
// Wenn die Karte mit den Zahlen nicht aufgeht, versucht der Generator es bis zu
// `maxAttempts` Mal neu und meldet dann einen Fehler.

export const mapgenConfig = {
  /** Standard-Kartengröße in Feldern (Breite x Höhe). */
  width: 30,
  height: 30,

  /** Das Festland hält so viele Felder Abstand zum Kartenrand (der Rand selbst ist Ozean). */
  edgeMargin: 2,
  /** Anteil des Festlands an ALLEN Feldern (0.45 = 45 %). */
  mainlandShare: 0.45,

  /** Wie viele Inseln es gibt (zufällig zwischen min und max). */
  islandCount: { min: 3, max: 6 },
  /** Größe einer Insel in Feldern (zufällig zwischen min und max). */
  islandSize: { min: 8, max: 20 },
  /** Mindestabstand einer Insel zu anderem Land (Felder dazwischen: Wert minus 1). */
  islandMinDistance: 3,
  /** Inseln dürfen näher an den Kartenrand als das Festland. */
  islandEdgeMargin: 1,

  /** Terrain-Anteile auf dem Festland. Was übrig bleibt, ist Ebene. */
  mainlandTerrain: { mountains: 0.1, hills: 0.17, forest: 0.25 },
  /** Terrain-Anteile auf den Inseln: mehr Hügel und Wald (Anreiz zur Besiedlung per Schiff). */
  islandTerrain: { mountains: 0.05, hills: 0.28, forest: 0.32 },

  /** Länge einer Bergkette in Feldern (zufällig zwischen min und max). */
  mountainChainLength: { min: 3, max: 6 },
  /** Hügel entstehen bevorzugt neben Bergen: so viel Bonus auf die Hügel-Punktzahl. */
  hillsNearMountainsBonus: 0.15,

  /** Größe der Rausch-Zellen in Feldern (ungefähr). Größer = großflächigere Formen. */
  noiseCellSize: 6,
  /** So oft wird die Karte neu erzeugt, bis alle Regeln erfüllt sind. */
  maxAttempts: 20,

  /** Form des Festlands (Feinjustierung). */
  mainlandShape: {
    /** Länglichkeit der Ellipse (Verhältnis lange/kurze Achse), zufällig zwischen min und max. */
    elongation: { min: 1.3, max: 1.8 },
    /** Verschiebung des Zentrums weg von der Kartenmitte (Anteil der Kartengröße), damit eine Meeresseite für Inseln frei bleibt. */
    centerShift: 0.2,
    /** Wie stark das Rauschen die Küstenlinie ausfranst (0 = glatte Ellipse). */
    noiseWeight: 0.5,
    /** Wie stark der Zufall einzelne Felder verändert. */
    jitter: 0.15,
  },

  /** Seeds: höchstens so viele Zeichen werden aus `?seed=…` übernommen. */
  seedMaxLength: 40,
  /** Ohne Seed in der Adresse wird eine Zufallszahl von 0 bis unter diesem Wert gewürfelt. */
  randomSeedRange: 1_000_000,
} as const;
