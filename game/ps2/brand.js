// The game's name and year, in one place. Kenny hasn't decided '96 or '04 yet: change YEAR here and the
// title screen, the logo on the menus, the browser tab and the World Cup's name all follow.
export const YEAR = "'04";
export const NAME = 'SUPER SOCCER STAR';

// Fills the title page's [data-year] spans and the tab title (index.html runs this before the game loads).
export function applyBrand(doc = document) {
  for (const el of doc.querySelectorAll('[data-year]')) el.textContent = YEAR;
  for (const el of doc.querySelectorAll('[data-brand-label]')) el.setAttribute('aria-label', `Super Soccer Star ${YEAR}`);
  doc.title = `Super Soccer Star ${YEAR}`;
}
