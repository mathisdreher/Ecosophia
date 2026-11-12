// Site-wide settings. Values that depend on where the site is deployed come
// from the environment (set by .github/workflows/deploy.yml).
export const SITE = {
  name: 'Ecosophia',
  languages: ['en', 'fr'],
  defaultLanguage: 'en',
  // Repository that holds the data. Links to it (report an error, suggest an
  // author, propose a claim) are shown only when the repository is public.
  repoUrl: process.env.REPO_URL || 'https://github.com/mathisdreher/Ecosophia',
  repoPublic: process.env.REPO_PUBLIC === 'true',
  // Year used to close the bars of living authors on the Rings view.
  currentYear: new Date().getFullYear(),
};
