// Keep these display choices aligned with the server's ingredient conversion rules.
const families = [
  { mg: 1, g: 1000, kg: 1000000, t: 1000000000 },
  { ml: 1, cl: 10, dl: 100, l: 1000 },
];
const aliases = {
  miligram: 'mg', gram: 'g', gr: 'g', kilogram: 'kg', kilo: 'kg',
  ton: 't', tonne: 't', mililiter: 'ml', milliliter: 'ml',
  sentiliter: 'cl', desiliter: 'dl', liter: 'l', litre: 'l', ltr: 'l',
};
const labels = { mg: 'mg', g: 'g', kg: 'kg', t: 'ton', ml: 'mL', cl: 'cL', dl: 'dL', l: 'L' };
const normalize = unit => {
  const key = String(unit ?? '').trim().toLowerCase();
  return Object.hasOwn(aliases, key) ? aliases[key] : key;
};
const familyFor = unit => families.find(family => Object.hasOwn(family, unit));

export function ingredientUnitChoices(base) {
  if (!base) return [];
  const unit = normalize(base);
  return [base, ...Object.keys(familyFor(unit) || {}).filter(key => key !== unit).map(key => labels[key])];
}

export function convertIngredientQuantity(value, from, to) {
  if (value === '') return '';
  const source = normalize(from), target = normalize(to);
  if (source === target) return value;
  const family = familyFor(source);
  if (!family || !Object.hasOwn(family, target)) return value;
  return Number((Number(value) * family[source] / family[target]).toPrecision(15));
}

export function formatIngredientStock(value, base) {
  const unit = normalize(base);
  const larger = unit === 'ml' || unit === 'cl' || unit === 'dl' ? ['L'] : ['t', 'kg'];
  const readable = larger.find(option => {
    const family = familyFor(unit);
    return family && Object.hasOwn(family, normalize(option)) && Math.abs(value * family[unit] / family[normalize(option)]) >= 1;
  });
  const shown = readable || base;
  const amount = convertIngredientQuantity(value, base, shown);
  const key = normalize(shown);
  const label = Object.hasOwn(labels, key) ? labels[key] : shown;
  return `${Number(amount || 0).toLocaleString('id-ID', { maximumFractionDigits: 9 })} ${label || ''}`.trim();
}
