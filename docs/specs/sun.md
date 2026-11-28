# Spécification — le vrai soleil, sans la position

Périmètre : `src/domain/sun` (pur). Sert le ciel de l'accueil (`features/garden/sky`) et la page
du lecteur (`features/reader/reader-paper.ts`). Décision du propriétaire du 27 novembre 2026 : le
passage du jour à la nuit suit le **vrai** lever et coucher du soleil, pas des heures fixes, **sans
demander l'autorisation de localisation** (D51).

```ts
placeOfTimeZone(zone: string | null | undefined, utcOffsetMinutes: number): Place
solarDayOn(date: LocalDate, position: GeoPosition): SolarDay
solarDateAt(instant: number, position: GeoPosition): LocalDate
isSunUpAt(instant: number, position: GeoPosition): boolean
referenceHourAt(instant: number, position: GeoPosition, reference: ReferenceDay): number
```

Un instant est un nombre de millisecondes depuis 1970 UTC (`Date.getTime()`). Les degrés sont
positifs au nord et à l'est.

## Règles

1. **La place vient du fuseau horaire.** Un nom de la base IANA (`America/Toronto`) prend les
   coordonnées que la base lui donne (`zone.tab`, sinon `zone1970.tab`) ; un ancien nom (lien de la
   base : `Asia/Calcutta`, `US/Eastern`) prend celles de la zone visée. La table est générée
   (`tools/sun-zones/build.mjs`, domaine public, `tools/sun-zones/NOTICE.txt`), jamais écrite à la
   main. **Repli** : fuseau inconnu ou sans lieu (`Etc/UTC`) → longitude = décalage UTC × 15° par
   heure (ramenée entre −180° et 180°), latitude 30° N. Le décalage va de −12 h à +14 h.
   La **date d'un instant** pour le soleil est celle du temps solaire moyen du lieu (UTC + 4 min
   par degré de longitude) : le jour solaire va d'un minuit solaire moyen au suivant.
2. **Les événements d'une date** : lever et coucher (centre du soleil à 90° 50′ du zénith :
   réfraction 34′ et rayon 16′), aube et crépuscule civils (centre à 6° sous l'horizon), midi
   solaire. Équations du calculateur solaire de la NOAA (d'après Meeus), affinées à l'heure de
   l'événement (deux passes). Écart à l'éphéméride PyEphem : **moins d'une minute** sous les
   cercles polaires (mesuré : 15 s au plus sur les cas testés), deux minutes au-delà de 64°.
3. **Jours et nuits polaires** : quand le soleil ne franchit pas une hauteur ce jour-là, il n'y a
   pas d'événement (`null`), jamais une heure fausse, et `sun` / `civilTwilight` disent pourquoi :
   `'always-up'` (jour polaire, nuit blanche) ou `'always-down'` (nuit polaire). Un jour a les
   deux franchissements ou aucun (décidé avec la déclinaison de midi). Aux pôles mêmes : jour ou
   nuit polaire, jamais `NaN`.
4. **Des instants, pas des heures d'horloge** : le passage à l'heure d'été ne déplace pas les
   événements (ils glissent d'une ou deux minutes par jour, comme le soleil) ; c'est l'horloge
   qui saute d'une heure.
5. **La nuit va du coucher au lever** : `isSunUpAt` est vrai du lever (compris) au coucher
   (exclu). Jour polaire : toujours vrai ; nuit polaire : toujours faux.
6. **Entrées invalides** : `RangeError` pour une latitude hors de −90…90, une longitude hors de
   −180…180, une valeur non finie, une date qui n'existe pas, un décalage UTC hors de −12 h…+14 h,
   une journée de référence mal ordonnée.
7. **Une journée dessinée, recalée sur le vrai soleil** (`referenceHourAt`) : une journée de
   référence donne les heures (0 à 24) de son aube civile, son lever, son coucher et son
   crépuscule civil, dans cet ordre. L'heure dessinée d'un instant tombe sur l'aube réelle à
   l'aube dessinée, sur le lever réel au lever dessiné, etc. ; entre deux repères, elle avance
   régulièrement ; la nuit va du crépuscule civil à l'aube civile suivante. Résultat de 0 (compris)
   à 24, sans saut d'une minute à l'autre un jour ordinaire, minuit compris.
   **Repère qui n'a pas lieu** : on prend la limite d'un franchissement qui a presque lieu. Un
   soleil qui ne descend jamais jusqu'à la hauteur la franchit aux minuits solaires ; un soleil qui
   n'y monte jamais, à midi solaire. Le tronçon qu'il ouvrirait est sauté : la journée dessinée ne
   montre jamais plus de lumière, ni plus de nuit, que le vrai soleil. Nuit blanche : jamais la nuit
   dessinée (saut du crépuscule à l'aube dessinés au minuit solaire). Jour polaire : la journée
   dessinée du lever au coucher sur tout le jour solaire, son midi au midi réel. Crépuscule polaire
   (soleil sous l'horizon mais au-dessus de −6° à midi) : aube puis crépuscule autour de midi,
   jamais le jour dessiné. Nuit polaire profonde : la nuit dessinée toute la journée.

## Ce que le module ne fait pas

- Il ne lit pas l'heure ni le fuseau : `src/features/sky-clock` les lit et les lui passe.
- La position est celle du fuseau, pas de la personne : à Lyon, l'appli calcule le soleil de Paris
  (une poignée de minutes d'écart) ; en Chine, tout le pays a le soleil de Shanghai (jusqu'à deux
  heures d'écart à Kachgar). C'est le prix de ne pas demander la position, choisi par le
  propriétaire.
- L'altitude du lieu et la météo ne sont pas prises en compte.
