# whiteweb

Publication du site famille White via GitHub Pages + configuration DNS/Email.

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