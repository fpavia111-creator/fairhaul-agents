# Agents de fret Fairhaul

*Traduit par Claude ; relecture par un locuteur natif en attente. Le [README](README.md) anglais fait foi.*

Trente petits agents MCP pour les coûts de fret et d'expédition. Chacun est responsable d'**une seule tâche**, comme contrôler une facture de transport, préparer la provision de fret de fin de mois, régler les transporteurs ou vérifier une déclaration en douane, et ne peut pas agir au-delà. Ils lisent les fichiers que vous exportez déjà de votre TMS, ERP, WMS, des portails transporteurs et de votre prestataire EDI, écrivent leurs rapports sur votre machine et attendent une personne nommée avant tout ce qui déplace de l'argent, envoie un message ou modifie un système en production.

Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · aucune dépendance

## Essayer

```bash
npx -y fairhaul-freight-bill-audit demo        # contrôle de factures de fret sur données fictives
npx -y fairhaul-freight-accruals demo     # provision de fret sur données fictives
```

Chaque agent a une `demo` sur fichiers fictifs, un `eval` sur ses propres cas de test et un serveur MCP (`npx -y <agent> mcp --root <dossier>`) pour Claude Desktop, Claude Code, Cursor et d'autres hôtes MCP. Les noms de colonnes et les rapports sont en anglais pour l'instant.

## Les agents

**Ce que facturent les transporteurs :** `fairhaul-freight-bill-audit` (factures complet et groupage contre contrats), `fairhaul-parcel-refunds` (factures colis), `fairhaul-detention-and-lumper` (immobilisation et attente), `fairhaul-fuel-surcharges` (surcharges carburant), `fairhaul-accessorial-charges` (origine des prestations annexes), `fairhaul-ltl-reweighs` (repesées et changements de classe), `fairhaul-duplicate-payments` (paiements en double), `fairhaul-ocean-freight-audit` (maritime), `fairhaul-air-freight-audit` (aérien), `fairhaul-proof-of-delivery` (preuves de livraison), `fairhaul-container-demurrage` (franchise des conteneurs et surestaries), `fairhaul-customs-entries` (déclarations en douane contre factures commerciales, sans conseil de classement).

**Planifier, acheter et piloter le fret :** `fairhaul-rfp-bid-scoring` (appels d'offres), `fairhaul-contract-rerating` (historique revalorisé sous chaque contrat), `fairhaul-spot-quotes` (cotations spot), `fairhaul-lane-spend` (dépenses par ligne et groupage), `fairhaul-carrier-scorecards` (tableaux de bord transporteurs), `fairhaul-carrier-vetting` (signaux de fraude), `fairhaul-load-tracking` (envois en retard), `fairhaul-dock-scheduling` (rendez-vous à quai), `fairhaul-carton-sizing` (tailles de cartons), `fairhaul-edi-files` (lecture et rapprochement des fichiers X12).

**Clôture et coûts :** `fairhaul-freight-accruals` (provision de fret), `fairhaul-freight-allocation` (fret réparti par commande et centre de coût), `fairhaul-standard-freight-cost` (standards de fret dans le coût des articles), `fairhaul-freight-margins` (fret facturé contre fret réel par client), `fairhaul-broker-settlements` (paiement des transporteurs pour courtiers), `fairhaul-freight-claims` (réclamations pour avarie), `fairhaul-returns-tracking` (retours jusqu'à l'avoir), `fairhaul-freight-emissions` (estimations d'émissions avec les facteurs de votre choix).

## Comment ils restent sûrs

- **Liste autorisée par agent.** Chaque agent ne peut appeler que ses propres outils.
- **Masqué avant que le modèle ne le voie.** Les noms des destinataires de colis et de retours, des signataires, des contacts et des chauffeurs deviennent des pseudonymes (`CU-3f2a9c1d`, `ST-8cea1a2d`) ; téléphones, e-mails et adresses deviennent des marqueurs. Les noms des transporteurs et des clients (entreprises), les numéros de chargement et de facture, les dates et les montants sont envoyés tels quels (`--pii strict` masque aussi les noms d’entreprises). Les fichiers écrits sur votre machine gardent les vraies valeurs.
- **Outils refusés.** Payer, envoyer des e-mails, modifier le TMS, comptabiliser au grand livre ou déposer en douane sont nommés et bloqués.
- **Un clic nominatif.** Paiements, envois, changements en production et validations d'écritures attendent une personne nommée, même en mode Auto, liés au sha256 du brouillon relu.
- **Journal d'audit** sous `.fairhaul/`, chaîné par hachage, signé si vous configurez une clé Ed25519.
- **Arrêt d'urgence :** `<agent> kill` arrête tous les outils jusqu'à `<agent> unkill`.

## Comment ils sont testés

Chaque agent a ses propres tests sur ses règles, les mêmes tests de contrat que tous les autres (arguments, fichiers hors de `--root`, mode Revue, arrêt d'urgence, approbation des brouillons, résultats reproductibles) et 14 à 22 cas d'évaluation sur des fichiers fictifs. Chaque cas avec un tableau est rejoué comme un export allemand, français, espagnol, brésilien, italien, japonais, chinois et coréen, et des données hostiles sont glissées dans les fichiers de chaque agent. Au total : 915 tests et 520 cas d'évaluation, réussis sur Node 20, 22 et 24. [REVIEW-ver3.md](REVIEW-ver3.md) (en anglais) liste les changements de la version 2 et les bogues trouvés.

## Limites

- Chaque agent travaille uniquement avec les fichiers que vous lui donnez et ne se connecte à aucun système de transporteur, TMS, ERP, banque ou administration.
- Aucun conseil juridique, fiscal, douanier ou comptable. Les personnes décident et agissent.
