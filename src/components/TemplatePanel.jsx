export default function TemplatePanel({
  mode,
  templates,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  templateName,
  onTemplateNameChange,
  templateDescription,
  onTemplateDescriptionChange,
  scopeText,
  templateNeedsOverwrite,
  templateTargetCounts,
  processing,
  onSave,
  onApply,
  onCancel,
  style,
}) {
  const selectedTemplate = templates.find((item) => String(item.id) === String(selectedTemplateId));

  return (
    <div className="operations-pattern-panel" style={style}>
      {mode === 'save' ? (
        <>
          <label>
            Nome do template
            <input value={templateName} onChange={(event) => onTemplateNameChange(event.target.value)} />
          </label>
          <label>
            Descrição (opcional)
            <input value={templateDescription} onChange={(event) => onTemplateDescriptionChange(event.target.value)} />
          </label>
          <label>
            Escopo
            <input value={scopeText} readOnly />
          </label>
          <div className="inventory-form-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
            <button className="inventory-secondary-button" type="button" onClick={onCancel}>
              Cancelar
            </button>
            <button className="inventory-primary-button" type="button" disabled={processing || !templateName.trim()} onClick={onSave}>
              {processing ? 'Salvando...' : 'Salvar template'}
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            Template
            <select value={selectedTemplateId} onChange={(event) => onSelectedTemplateIdChange(event.target.value)}>
              <option value="">Selecione</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.department_detail?.code || '-'} / {item.process_detail?.code || '-'} / {item.shift_detail?.code || '-'})
                </option>
              ))}
            </select>
          </label>
          <label>
            Descrição
            <input value={selectedTemplate?.description || ''} readOnly />
          </label>
          <label>
            Confirmação
            <input
              value={
                templateNeedsOverwrite
                  ? `Sobrescrever ${templateTargetCounts.assignments} linhas / ${templateTargetCounts.cells} células`
                  : 'Aplicação conservadora'
              }
              readOnly
            />
          </label>
          <div className="inventory-form-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
            <button className="inventory-secondary-button" type="button" onClick={onCancel}>
              Cancelar
            </button>
            <button className="inventory-primary-button" type="button" disabled={processing || !selectedTemplateId} onClick={onApply}>
              {processing ? 'Aplicando...' : templateNeedsOverwrite ? 'Confirmar e sobrescrever' : 'Aplicar template'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
