import { cloneElement, type ReactElement, useId, useState } from 'react';
import { Button } from '../../../apps/web/src/components/ui/button';
import { Input } from '../../../apps/web/src/components/ui/input';
export function Field({
  title,
  children,
}: {
  title: string;
  children: ReactElement<{ id?: string }>;
}) {
  const fieldId = useId();
  return (
    <label className="field" htmlFor={fieldId}>
      <span>{title}</span>
      {cloneElement(children, { id: fieldId })}
    </label>
  );
}
type Option = { value: string; label: string };
export function Picker({
  title,
  value,
  options,
  onChange,
  optional = false,
}: {
  title: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const choices = (optional ? [{ value: '', label: 'Ninguno' }, ...options] : options).filter(
    (option) => `${option.label} ${option.value}`.toLowerCase().includes(query.toLowerCase()),
  );
  const custom = query.trim() && !choices.some((option) => option.value === query.trim());
  const items = custom
    ? [...choices, { value: query.trim(), label: `Usar: ${query.trim()}` }]
    : choices;
  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }
  return (
    <fieldset
      className="field picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          if (query.trim())
            onChange(
              options.find((option) => option.label === query.trim())?.value ?? query.trim(),
            );
          setOpen(false);
          setQuery('');
        }
      }}
    >
      <label htmlFor={uid}>{title}</label>
      <div className="picker-input">
        <Input
          id={uid}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${uid}-options`}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${uid}-${active}` : undefined}
          value={
            open
              ? query
              : (options.find((option) => option.value === value)?.label ?? (value || 'Ninguno'))
          }
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery('');
              event.stopPropagation();
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                Math.max(
                  0,
                  Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
                ),
              );
            }
            if (event.key === 'Enter' && open) {
              event.preventDefault();
              if (items[active]) choose(items[active].value);
            }
          }}
        />
        <span aria-hidden="true">⌄</span>
      </div>
      {open && (
        <div className="picker-options" id={`${uid}-options`} role="listbox" aria-label={title}>
          {items.map((option, index) => (
            <div
              key={option.value}
              id={`${uid}-${index}`}
              role="option"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === 'Enter') choose(option.value);
              }}
              aria-selected={value === option.value}
              className={index === active ? 'active' : ''}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}
              onMouseEnter={() => setActive(index)}
            >
              {option.label}
              {value === option.value && <span>✓</span>}
            </div>
          ))}
          {!items.length && <div className="picker-empty">Sin opciones</div>}
        </div>
      )}
    </fieldset>
  );
}
export function SkillsPicker({
  options,
  value,
  onChange,
  title = 'Skills disponibles',
}: {
  title?: string;
  options: { name: string; path: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const names = [...new Set([...options.map((option) => option.name), ...value])];
  return (
    <section className="skills-picker" aria-label={title}>
      <div className="section-heading">
        <h3>{title}</h3>
        <span className="count">{value.length}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          Quitar todas
        </Button>
      </div>
      <div className="chips">
        {value.map((name) => (
          <button
            type="button"
            className="chip"
            key={name}
            onClick={() => onChange(value.filter((item) => item !== name))}
            aria-label={`Quitar ${name}`}
          >
            {name}
            <span>×</span>
          </button>
        ))}
      </div>
      <Input
        aria-label={`Buscar ${title.toLowerCase()}`}
        placeholder="Buscar skills…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="skill-options">
        {names
          .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
          .map((name) => (
            <label key={name}>
              <input
                type="checkbox"
                checked={value.includes(name)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...value, name] : value.filter((item) => item !== name),
                  )
                }
              />
              <span>{name}</span>
            </label>
          ))}
      </div>
    </section>
  );
}
