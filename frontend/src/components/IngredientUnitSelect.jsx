import { ingredientUnitChoices } from '@/lib/ingredientUnits';

export default function IngredientUnitSelect({ base, value, onChange, label = 'Satuan jumlah', disabled = false }) {
  const choices = ingredientUnitChoices(base);
  if (!choices.length) return null;
  return (
    <label className="block">
      <span className="label-tiny">{label}</span>
      <select className="input-field mt-1" disabled={disabled} value={value || base} onChange={event => onChange(event.target.value)}>
        {choices.map(unit => <option key={unit} value={unit}>{unit}</option>)}
      </select>
    </label>
  );
}
