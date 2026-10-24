# Qualité de l'air Norvège

## Ce que fait l'intégration

Cette intégration apporte dans Gladys la **prévision de qualité de l'air de MET Norway**, l'institut météorologique norvégien : l'indice norvégien de qualité de l'air et les polluants qui le composent, pour l'heure en cours et les 24 heures à venir. Le modèle est le modèle officiel norvégien (celui de la carte luftkvalitet.info), à l'échelle du quartier.

- **Un appareil par lieu** : chaque maison de Gladys située en Norvège, et les stations de mesure que vous ajoutez.
- **Déclencheurs de scène** : qualité de l'air dégradée maintenant, dégradation prévue dans les 24 heures, retour à la normale.
- **Une action de scène** qui donne la qualité de l'air d'un lieu, avec une phrase prête pour une notification.
- **Un widget** de tableau de bord : les polluants, le niveau maintenant et sur les 24 prochaines heures.

En lecture seule, par l'API ouverte de MET Norway (`api.met.no`) : sans compte ni clé. Non affilié à MET Norway.

## Prérequis

- Gladys Assistant **5.2.0** ou plus récent.
- Une maison située **en Norvège** (Paramètres → Maisons → position), ou le code d'une station de mesure norvégienne. MET Norway n'a pas de prévision de qualité de l'air ailleurs.
- Un accès Internet à `api.met.no`.

## Configuration

| Champ                    | À saisir                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zone autour d'une maison | La zone dont une maison reçoit la prévision : son **quartier** (grunnkrets, par défaut, le plus fin), son **secteur** (delområde) ou sa **commune** (kommune).                                                                |
| Stations                 | Facultatif. Les codes des stations de mesure à suivre en plus, séparés par des virgules (10 au plus), par exemple `NO0057A`. Le bouton **Trouver une station** les donne, par nom ou autour d'une maison, avec leur distance. |
| Langue                   | Langue des noms de fonctionnalités (fixés à l'ajout d'un appareil) et des textes de scène. Français par défaut.                                                                                                               |

Chaque maison qui a une position devient un appareil de l'onglet **Découverte**, si elle est en Norvège. Une maison hors de Norvège est écartée, et le statut de l'écran de configuration le dit quand il ne reste aucun lieu.

Le bouton **Vérifier les lieux** relit chaque lieu et indique ce que prévoit MET Norway : le niveau, et le pire niveau des 24 prochaines heures.

## Appareils

Chaque lieu (maison ou station) donne un appareil, nommé `MET Norway <maison ou station>`, avec :

| Fonctionnalité             | Signification                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Indice de qualité de l'air | L'indice norvégien de l'heure en cours : **moins de 2 faible, de 2 à 3 modéré, de 3 à 4 élevé, 4 et plus très élevé**. |
| Qualité de l'air           | Son niveau en clair : Faible, Modéré, Élevé, Très élevé.                                                               |
| PM2.5, PM10, NO₂, O₃       | Les concentrations prévues, en µg/m³.                                                                                  |
| Indice maximal sur 24 h    | La pire heure d'ici 24 heures.                                                                                         |
| Qualité de l'air sur 24 h  | Son niveau en clair.                                                                                                   |

L'indice est affiché avec une décimale, jamais arrondi au-dessus d'un seuil de niveau (1,96 est « Faible » et s'affiche 1.9). L'indice global est le plus élevé de ceux des polluants.

MET Norway met à jour la prévision quelques fois par jour. L'intégration lit chaque lieu **une fois par heure**, par une requête conditionnelle (rien n'est téléchargé quand la prévision n'a pas changé), et passe d'elle-même à l'heure suivante.

## Widget

**Qualité de l'air Norvège** : avec un lieu choisi dans ses réglages, quatre tuiles (PM2.5, PM10, NO₂, O₃) qui suivent l'appareil, le niveau maintenant et le pire niveau des 24 prochaines heures avec son heure, en vert (faible), orange (modéré) ou rouge (élevé, très élevé). Sans lieu : une ligne par lieu ajouté, avec son niveau actuel.

## Scènes

### Déclencheurs

- **Air Norvège : qualité de l'air dégradée** : le niveau d'un lieu passe maintenant à « Modéré » ou pire, ou s'aggrave encore. Filtres : le lieu, les nouveaux niveaux (cochez à partir de votre seuil). Variables : nom du lieu, niveau, indice, niveau précédent, polluant qui fixe l'indice, résumé.
- **Air Norvège : dégradation prévue** : le pire niveau des 24 prochaines heures passe à « Modéré » ou pire, ou s'aggrave encore. Filtres : le lieu, les niveaux prévus. Variables : les mêmes, plus l'heure du pic et le nombre d'heures avant lui.
- **Air Norvège : retour à la normale** : le niveau revient à « Faible » après une dégradation. Filtres : le lieu, le pire niveau atteint. Variables : nom du lieu, niveau, indice, pire niveau, résumé.

La première évaluation après l'installation ne fait que fixer les niveaux de départ : rien ne se déclenche. Un redémarrage ne redéclenche rien.

### Action

**Air Norvège : obtenir la qualité de l'air** : d'un lieu, ou du lieu dont l'indice est le pire. Sorties : résumé (par exemple `MET Norway Hjemme : Faible (1.6) · PM2.5 2.8 µg/m³ · … · Sur 24 h : Modéré à 17:00`), nom du lieu, niveau, indice, polluant, les quatre concentrations, le pire niveau, l'indice et l'heure des 24 prochaines heures.

## Exemples de scènes

- **Prévenir avant que ça se gâte** : déclencheur « dégradation prévue », niveaux Élevé et Très élevé → envoyer un message « Qualité de l'air {{triggerEvent.data.level_label}} prévue à {{triggerEvent.data.time}} vers {{triggerEvent.data.place_name}} ».
- **Fermer les fenêtres** : déclencheur « qualité de l'air dégradée », niveau Modéré et pire → notifier, ou baisser la ventilation ; déclencheur « retour à la normale » → la remonter.
- **Point du matin** : à 7 h, action « obtenir la qualité de l'air » → envoyer son résumé avec la météo.

## Dépannage

- **Aucun appareil dans Découverte** : la maison n'a pas de position, ou elle est hors de Norvège (voir le statut de l'écran de configuration et le bouton **Vérifier les lieux**). Réglez la position dans Paramètres → Maisons.
- **« pas une station de MET Norway »** : le code n'est pas dans la liste des stations. Utilisez **Trouver une station** ; quelques stations locales ont un code sensible à la casse (`Loallme`).
- **« MET Norway ne répond pas »** : l'API est injoignable ; les valeurs de la prévision déjà lue continuent d'être publiées tant qu'elle couvre l'heure.
- Plus de détails : l'onglet **Journaux** de l'intégration (`LOG_LEVEL=debug` pour chaque requête).

## Limites

- Une **prévision**, pas une mesure, issue d'un modèle à l'échelle du quartier : un appareil de station donne la prévision à la station, pas ce qu'elle mesure.
- Norvège seulement. L'indice est l'indice norvégien, pas l'indice européen.
- Conditions de MET Norway : un User-Agent qui identifie l'intégration, normalement une requête par lieu et par heure, jamais avant l'`Expires` de la réponse précédente, des attentes plus longues après un échec, une pause en cas de HTTP 429. Données © MET Norway, sous licence CC BY 4.0 ([conditions](https://api.met.no/doc/TermsOfService)).
