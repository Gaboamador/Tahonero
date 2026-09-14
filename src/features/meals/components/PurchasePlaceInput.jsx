import { useId } from 'react';
import styles from './MealsModule.module.scss';

function PurchasePlaceInput({ value, onChange, suggestions = [], label = 'Lugar de compra' }) {
  const datalistId = useId();

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type="text"
        list={datalistId}
        value={value || ''}
        placeholder="Ej: Supermercado"
        onChange={(event) => onChange(event.target.value)}
      />
      {suggestions.length > 0 ? (
        <datalist id={datalistId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

export default PurchasePlaceInput;
