import React from 'react';

function renderField(field, value, handleChange) {
  const id = `${field.name}-input`;
  const commonProps = {
    id,
    name: field.name,
    value: value ?? '',
    onChange: event => handleChange(field.name, event.target.value),
    className: 'border p-2 rounded w-full',
    'aria-label': field.label
  };
  
  if (field.type === 'textarea') {
    return <textarea {...commonProps} rows={3} placeholder={field.placeholder} />;
  }

  if (field.type === 'select') {
    return (
      <select {...commonProps}>
        {(field.options || []).map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
     );
  }

  const inputType = field.type === 'number' ? 'number' : 'text';
  return <input {...commonProps} type={inputType} placeholder={field.placeholder} step={field.type === 'number' ? 'any' : undefined} />;
}

export default function TradeForm({ definition, fields, values, errors, onChange, onSubmit, isSubmitting }) {
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSubmit?.();
      }}
      className="space-y-3"
    >
      <div>
        <h2 className="text-xl font-semibold">{definition.title}</h2>
        {definition.description && (
          <p className="text-sm text-gray-600 mt-1">{definition.description}</p>
        )}
      </div>
      {errors?.form && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
          {errors.form}
        </div>
      )}
          {fields.map(field => (
        <div key={field.name} className="space-y-1">
          <label htmlFor={`${field.name}-input`} className="text-sm font-medium text-gray-700">
            {field.label}
          </label>
          {renderField(field, values?.[field.name], onChange)}
          {field.helpText && <p className="text-xs text-gray-500">{field.helpText}</p>}
          {errors?.[field.name] && (
            <p className="text-xs text-red-600">{errors[field.name]}</p>
          )}
        </div>
      ))}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        disabled={isSubmitting}
      >
       {isSubmitting ? 'Submitting…' : definition.submitLabel || 'Submit Trade'}
      </button>
    </form>
  );
}
