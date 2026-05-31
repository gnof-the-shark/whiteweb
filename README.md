# whiteweb

Publication du site famille White via GitHub Pages + configuration DNS/Email.

## Pages de contact

- `me-contacter.html` : **publique** avec `contact@white.is-a.dev`
- `contacter.html` : **protégée** (prénom obligatoire, vérification côté serveur)

### Démarrage local du serveur protégé

```bash
ALLOWED_FIRST_NAMES="alice,bob" \
CONTACT_OTHERS_JSON='["Alice: alice@example.com", "Bob: bob@example.com"]' \
npm start
```

Puis ouvrir `http://localhost:8080/contacter.html`.

> Les coordonnées privées ne sont pas dans le HTML et doivent être passées via `CONTACT_OTHERS_JSON`.

## GitHub Pages

1. Ouvrir **Settings > Pages** du repo `gnof-the-shark/whiteweb`.
2. Source: **GitHub Actions**.
3. Le workflow `.github/workflows/pages.yml` déploie `index.html` automatiquement.

## DNS `white.is-a.dev` (A, pas CNAME)

Configurer ces enregistrements DNS :

### A

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

### MX

- `mx1.improvmx.com`
- `mx2.improvmx.com`

### TXT

- `v=spf1 include:spf.improvmx.com ~all`

## ImprovMX forwarding

- Domaine : `white.is-a.dev`
- Destination : configurer l'alias owner vers l'email du propriétaire dans le dashboard ImprovMX
